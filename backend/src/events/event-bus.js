import { EventEmitter } from 'events';
import { insertDetection } from '../repositories/search.repository.js';
import { findMatchingWatchlistItems } from '../repositories/watchlist.repository.js';
import { database } from '../repositories/database.js';
import { createAlert } from '../repositories/alert.repository.js';
import { attachDetectionToInvestigation } from '../repositories/investigation.repository.js';

class ResilientEventBus extends EventEmitter {
  constructor(maxBufferSize = 2000) {
    super();
    this.maxBufferSize = maxBufferSize;
    this.buffer = [];
    this.isProcessing = false;
  }

  publish(topic, payload) {
    if (this.buffer.length >= this.maxBufferSize) {
      // Drop oldest event if buffer is full to prevent memory explosion
      this.buffer.shift();
    }
    this.buffer.push({ topic, payload, timestamp: Date.now() });
    this.processNext();
  }

  async processNext() {
    if (this.isProcessing || this.buffer.length === 0) return;
    this.isProcessing = true;

    const event = this.buffer.shift();
    try {
      if (event.topic === 'ai.detections') {
        await this.handleDetectionEvent(event.payload);
      }
      this.emit(event.topic, event.payload);
    } catch (err) {
      console.error('Error processing event from event bus:', err.message);
    } finally {
      this.isProcessing = false;
      if (this.buffer.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  async handleDetectionEvent(payload) {
    const {
      cameraId,
      cityId,
      departmentId,
      detectionType = 'PLATE',
      confidence = 0.92,
      trackId,
      plateNumber,
      vehicleType,
      vehicleColor,
      evidenceUrl
    } = payload;

    // 1. Persist detection in database
    const savedDetection = await insertDetection({
      cameraId,
      cityId,
      departmentId,
      detectionType,
      confidence,
      trackId,
      plateNumber,
      vehicleType,
      vehicleColor,
      evidenceUrl
    });

    // 2. Check Watchlist matches
    if (plateNumber) {
      const matchingItems = await findMatchingWatchlistItems(plateNumber);
      for (const item of matchingItems) {
        await createAlert({
          detectionId: savedDetection.id,
          cameraId,
          cityId,
          departmentId,
          severity: item.severity || 'CRITICAL',
          title: `Watchlist Match: ${plateNumber}`,
          description: `Vehicle plate ${plateNumber} matched watchlist "${item.watchlistName}". Reason: ${item.itemDescription || 'Wanted vehicle'}`,
          metadata: { watchlistId: item.watchlistId, confidence, vehicleType, vehicleColor }
        });
      }

      // 3. Check Investigation targets
      try {
        const invResults = await database().query(
          `SELECT id, case_number, department_id FROM investigations
           WHERE status IN ('OPEN', 'IN_PROGRESS', 'MATCH_FOUND')
             AND target_value = $1`,
          [plateNumber.trim().toUpperCase()]
        );
        for (const inv of invResults.rows) {
          await attachDetectionToInvestigation(inv.id, savedDetection.id, `Automatic ANPR capture on plate ${plateNumber}`, confidence);
        }
      } catch (invErr) {
        console.error('Error matching investigation target:', invErr.message);
      }
    }
  }
}

export const eventBus = new ResilientEventBus();
