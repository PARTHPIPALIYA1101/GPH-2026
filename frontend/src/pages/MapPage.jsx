import React, { useState, useEffect } from 'react';
import { CameraMap } from '../map/CameraMap.jsx';
import { apiRequest } from '../services/api.js';
import { Map as MapIcon, Search, Crosshair, Clock, MapPin, Video, Info } from 'lucide-react';
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
      // Use existing search endpoint
      const res = await apiRequest(`/search?plate=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.success && res.data?.items?.length > 0) {
        // Sort detections chronologically descending (newest first)
        const history = res.data.items.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
        setTargetHistory(history);
        setTrackingPlate(searchQuery.toUpperCase());
        setIsTracking(true);
        showToast(`Target acquired: ${history.length} sightings found for ${searchQuery.toUpperCase()}`, 'success');
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2"><MapIcon size={24} style={{ color: 'var(--brand-terracotta)' }} /> GIS INTELLIGENCE</h1>
          <p>Statewide camera map and active target tracking.</p>
        </div>
        <div style={{ width: '400px' }}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="form-group flex-1" style={{ position: 'relative', margin: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Track Target (Plate No)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 36, textTransform: 'uppercase' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Crosshair size={16} /> TRACK
            </button>
          </form>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        {/* Left Side: Map Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CameraMap onSelectCameraForLive={onOpenLiveStream} />
        </div>

        {/* Right Side: Target Tracking Intelligence Workspace */}
        {isTracking && (
          <div style={{ width: '380px', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--structure-dark)', color: '#fff' }}>
              <div className="flex justify-between items-center mb-1">
                <span className="badge badge-critical" style={{ fontSize: '10px' }}><Crosshair size={10} style={{ marginRight: 4 }}/> ACTIVE TRACK</span>
                <button onClick={stopTracking} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.5, cursor: 'pointer' }}>Close</button>
              </div>
              <h2 className="mono" style={{ color: '#fff', fontSize: '24px', margin: '4px 0' }}>{trackingPlate}</h2>
              {latestDetection && (
                <div style={{ fontSize: '12px', color: '#9BA3AB' }}>
                  {latestDetection.vehicleColor} {latestDetection.vehicleType}
                </div>
              )}
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {latestDetection && (
                <div className="mb-2">
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>LATEST INTELLIGENCE</div>
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-light)', borderRadius: '2px' }}>
                    <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--status-info)' }}>
                      <MapPin size={14} /> <strong>{latestDetection.cityName}</strong>
                    </div>
                    <div className="flex items-center gap-2 mb-1" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <Video size={14} style={{ color: 'var(--text-secondary)' }} /> {latestDetection.cameraName}
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> {new Date(latestDetection.detectedAt).toLocaleString()}
                    </div>
                    {latestDetection.isWatchlistMatch && (
                      <div className="mt-1">
                        <span className="badge badge-critical">WATCHLIST MATCH</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '6px' }}>OPEN INVESTIGATION</button>
                    <button className="btn btn-primary" style={{ flex: 1, fontSize: '11px', padding: '6px' }} onClick={() => showToast('Connecting to live feed...', 'info')}>VIEW CAMERA</button>
                  </div>
                </div>
              )}

              <div className="mt-2">
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '16px' }}>MOVEMENT TIMELINE</div>
                <div className="timeline">
                  {targetHistory.map((event, idx) => (
                    <div key={event.id} className="timeline-event" style={{ opacity: idx === 0 ? 1 : 0.7 }}>
                      <div className="flex items-center justify-between mb-1">
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{event.cameraName}</div>
                        <div className="mono text-secondary" style={{ fontSize: '11px' }}>{new Date(event.detectedAt).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <MapPin size={10} /> {event.cityName}
                        {idx === 0 && <span className="badge badge-info" style={{ padding: '0px 4px', fontSize: '9px', marginLeft: '6px' }}>LATEST</span>}
                      </div>
                      {event.isWatchlistMatch && (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge badge-critical" style={{ padding: '0px 4px', fontSize: '9px' }}>ALERT</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
