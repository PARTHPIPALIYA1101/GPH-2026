import React, { useState, useEffect } from 'react';
import { CameraMap } from '../map/CameraMap.jsx';
import { apiRequest } from '../services/api.js';
import {
  Map as MapIcon,
  Search,
  Crosshair,
  Clock,
  MapPin,
  Video,
  X,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';

export function MapPage({ onOpenLiveStream }) {
  const { showToast } = useUI();
  const [trackingPlate, setTrackingPlate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetHistory, setTargetHistory] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsTracking(false);
      setTargetHistory([]);
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest(`/search?plateNumber=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.success && res.data?.items?.length > 0) {
        const history = res.data.items.sort(
          (a, b) => new Date(b.detectedAt) - new Date(a.detectedAt)
        );
        setTargetHistory(history);
        setTrackingPlate(searchQuery.toUpperCase());
        setIsTracking(true);
        showToast(
          `Target acquired: ${history.length} sightings found for ${searchQuery.toUpperCase()}`,
          'success'
        );
      } else {
        showToast('No detection history found for this target.', 'warning');
        setIsTracking(false);
        setTargetHistory([]);
      }
    } catch (err) {
      showToast(`Search failed: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }

  function stopTracking() {
    setIsTracking(false);
    setTargetHistory([]);
    setTrackingPlate('');
    setSearchQuery('');
  }

  const latestDetection = targetHistory.length > 0 ? targetHistory[0] : null;

  return (
    <div className="gis-page-shell">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="gis-header">
        <div className="gis-header-left">
          <div className="gis-header-icon">
            <MapIcon size={18} />
          </div>
          <div>
            <h1 className="gis-title">GIS INTELLIGENCE</h1>
            <p className="gis-subtitle">Statewide Camera Map &amp; Active Target Tracking</p>
          </div>
        </div>

        <div className="gis-header-right">
          {/* Target tracking search */}
          <form onSubmit={handleSearch} className="gis-track-form">
            <div className="gis-search-wrap">
              <Search size={14} className="gis-search-icon" />
              <input
                type="text"
                className="gis-search-input"
                placeholder="Track Target — Plate No."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                spellCheck={false}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary gis-track-btn"
              disabled={loading}
            >
              <Crosshair size={14} />
              {loading ? 'SEARCHING…' : 'TRACK'}
            </button>
            {isTracking && (
              <button
                type="button"
                className="btn btn-secondary gis-clear-btn"
                onClick={stopTracking}
                title="Stop tracking"
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Live tracking indicator */}
          {isTracking && (
            <div className="gis-active-indicator">
              <span className="gis-active-dot" />
              TRACKING ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* ── Body: Map + Side Panel ───────────────────────────────────────── */}
      <div className="gis-body">
        {/* Map area */}
        <div className="gis-map-area">
          <CameraMap onSelectCameraForLive={onOpenLiveStream} />
        </div>

        {/* Target Intelligence Panel */}
        {isTracking && (
          <aside className="gis-intel-panel">
            {/* Panel header */}
            <div className="gis-intel-header">
              <div className="gis-intel-header-top">
                <span className="badge badge-critical gis-track-badge">
                  <Crosshair size={10} style={{ marginRight: 5 }} />
                  ACTIVE TRACK
                </span>
                <button
                  className="gis-intel-close"
                  onClick={stopTracking}
                  title="Stop tracking"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="gis-intel-plate mono">{trackingPlate}</div>
              {latestDetection && (
                <div className="gis-intel-vehicle">
                  {latestDetection.vehicleColor} {latestDetection.vehicleType}
                </div>
              )}
            </div>

            <div className="gis-intel-body">
              {/* Latest Detection */}
              {latestDetection && (
                <section className="gis-intel-section">
                  <div className="gis-section-label">LATEST INTELLIGENCE</div>

                  <div className="gis-detection-card">
                    {latestDetection.isWatchlistMatch && (
                      <div className="gis-watchlist-alert">
                        <AlertTriangle size={12} />
                        WATCHLIST MATCH — HIGH PRIORITY
                      </div>
                    )}

                    <div className="gis-detection-row">
                      <MapPin size={13} className="gis-row-icon text-info" />
                      <div>
                        <div className="gis-row-label">Location</div>
                        <div className="gis-row-value">{latestDetection.cityName}</div>
                      </div>
                    </div>

                    <div className="gis-detection-row">
                      <Video size={13} className="gis-row-icon" />
                      <div>
                        <div className="gis-row-label">Camera</div>
                        <div className="gis-row-value">{latestDetection.cameraName}</div>
                      </div>
                    </div>

                    <div className="gis-detection-row">
                      <Clock size={13} className="gis-row-icon" />
                      <div>
                        <div className="gis-row-label">Detected At</div>
                        <div className="gis-row-value mono" style={{ fontSize: 11 }}>
                          {new Date(latestDetection.detectedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="gis-detection-actions">
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '6px 10px' }}>
                        OPEN INVESTIGATION
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 11, padding: '6px 10px' }}
                        onClick={() => showToast('Connecting to live feed…', 'info')}
                      >
                        VIEW CAMERA
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Movement Timeline */}
              <section className="gis-intel-section">
                <div className="gis-section-label">
                  MOVEMENT TIMELINE
                  <span className="gis-timeline-count">{targetHistory.length}</span>
                </div>

                <div className="timeline">
                  {targetHistory.map((event, idx) => (
                    <div
                      key={event.id}
                      className="timeline-event gis-timeline-event"
                      style={{ opacity: idx === 0 ? 1 : 0.72 }}
                    >
                      <div className="gis-tl-row">
                        <div className="gis-tl-camera">{event.cameraName}</div>
                        <div className="mono gis-tl-time">
                          {new Date(event.detectedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="gis-tl-meta">
                        <MapPin size={10} style={{ flexShrink: 0 }} />
                        <span>{event.cityName}</span>
                        {idx === 0 && (
                          <span className="badge badge-info" style={{ padding: '1px 5px', fontSize: '9px' }}>
                            LATEST
                          </span>
                        )}
                        {event.isWatchlistMatch && (
                          <span className="badge badge-critical" style={{ padding: '1px 5px', fontSize: '9px' }}>
                            ALERT
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
