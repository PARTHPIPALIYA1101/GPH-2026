import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';

export function LiveMatrix({ initialCamera = null }) {
  const [gridSize, setGridSize] = useState(4); // 1, 4, 9, 16
  const [slots, setSlots] = useState(Array(16).fill(null));
  const [cameraPickerSlot, setCameraPickerSlot] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeSessionStats, setActiveSessionStats] = useState({ activeViews: 0, maxViews: 16 });

  useEffect(() => {
    loadSessionStats();
    if (initialCamera) {
      openCameraInSlot(0, initialCamera, 'AI_ANNOTATED');
    }
  }, []);

  async function loadSessionStats() {
    try {
      const res = await apiRequest('/streams/stats');
      if (res.success && res.data) {
        setActiveSessionStats(res.data);
      }
    } catch {
      // stats fallback
    }
  }

  async function openCameraPicker(slotIndex) {
    setCameraPickerSlot(slotIndex);
    setLoadingCameras(true);
    try {
      const res = await apiRequest('/cameras?limit=100');
      if (res.success && res.data) {
        setAvailableCameras(res.data.items || []);
      }
    } catch (err) {
      alert(`Failed to load authorized cameras: ${err.message}`);
    } finally {
      setLoadingCameras(false);
    }
  }

  const [slotStates, setSlotStates] = useState({});

  async function openCameraInSlot(slotIndex, camera, streamType = 'AI_ANNOTATED') {
    setSlotStates((prev) => ({ ...prev, [slotIndex]: 'LOADING' }));
    try {
      const res = await apiRequest('/streams/session', {
        method: 'POST',
        body: { cameraId: camera.id, streamType }
      });

      if (res.success && res.data) {
        const newSlots = [...slots];
        newSlots[slotIndex] = {
          camera,
          session: res.data,
          streamType,
          startedAt: Date.now()
        };
        setSlots(newSlots);
        setCameraPickerSlot(null);
        loadSessionStats();
      }
    } catch (err) {
      alert(`Failed to authorize camera stream: ${err.message}`);
      setSlotStates((prev) => ({ ...prev, [slotIndex]: 'ERROR' }));
    }
  }

  function handleImageLoad(index) {
    setSlotStates((prev) => ({ ...prev, [index]: 'CONNECTED' }));
  }

  function handleImageError(index) {
    setSlotStates((prev) => ({ ...prev, [index]: 'RECONNECTING' }));
  }

  async function closeSlotStream(slotIndex) {
    const slot = slots[slotIndex];
    if (!slot) return;

    try {
      if (slot.session?.sessionId) {
        await apiRequest('/streams/session/release', {
          method: 'POST',
          body: { sessionId: slot.session.sessionId }
        });
      }
    } catch {
      // release safeguard
    }

    const newSlots = [...slots];
    newSlots[slotIndex] = null;
    setSlots(newSlots);
    loadSessionStats();
  }

  function toggleStreamType(slotIndex) {
    const newSlots = [...slots];
    if (!newSlots[slotIndex]) return;
    const currentType = newSlots[slotIndex].streamType;
    newSlots[slotIndex] = {
      ...newSlots[slotIndex],
      streamType: currentType === 'AI_ANNOTATED' ? 'RAW' : 'AI_ANNOTATED'
    };
    setSlots(newSlots);
    setSlotStates((prev) => ({ ...prev, [slotIndex]: 'LOADING' }));
  }

  function clearAllSlots() {
    slots.forEach((_, idx) => closeSlotStream(idx));
    setSlots(Array(16).fill(null));
    setSlotStates({});
  }

  const visibleSlots = slots.slice(0, gridSize);
  const activeVisibleCount = visibleSlots.filter(Boolean).length;
  const activeTotalCount = slots.filter(Boolean).length;

  return (
    <div>
      <div className="live-matrix-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)' }}>Grid Layout:</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { size: 1, label: '1x1 (Single)' },
              { size: 4, label: '2x2 (4-Up)' },
              { size: 9, label: '3x3 (9-Up)' },
              { size: 16, label: '4x4 (16-Up)' }
            ].map((g) => (
              <button
                key={g.size}
                className={`btn btn-sm ${gridSize === g.size ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setGridSize(g.size)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={clearAllSlots}
            style={{ marginLeft: 8, fontSize: '11px' }}
          >
            Clear Grid
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Active Viewport Feeds: <strong>{activeVisibleCount}</strong> / {gridSize} Visible ({activeTotalCount} Total Session Views)
        </div>
      </div>

      <div className={`matrix-grid matrix-grid-${gridSize}`}>
        {visibleSlots.map((slot, index) => {
          const currentState = slotStates[index] || (slot ? 'LOADING' : 'IDLE');

          return (
            <div key={index} className="video-cell">
              {slot ? (
                <>
                  <div className="video-cell-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge badge-${slot.streamType === 'AI_ANNOTATED' ? 'active' : 'secondary'}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                        {slot.streamType === 'AI_ANNOTATED' ? 'AI LIVE' : 'RAW RTSP'}
                      </span>
                      <strong style={{ fontSize: '11.5px' }}>{slot.camera.name}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>({slot.camera.city})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '10px', padding: '2px 5px' }}
                        onClick={() => toggleStreamType(index)}
                        title="Toggle Raw RTSP vs AI Annotated feed"
                      >
                        {slot.streamType === 'AI_ANNOTATED' ? 'Switch to Raw' : 'Switch to AI'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: '10px', padding: '2px 5px' }}
                        onClick={() => closeSlotStream(index)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="video-cell-screen" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a', width: '100%', height: '100%' }}>
                    {currentState === 'LOADING' && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2, 6, 23, 0.94)',
                        zIndex: 10, padding: 16, textAlign: 'center'
                      }}>
                        <div className="matrix-spinner" style={{
                          width: 36, height: 36, borderRadius: '50%',
                          border: '3px solid rgba(56, 189, 248, 0.2)', borderTopColor: '#38bdf8',
                          animation: 'spin 0.8s linear infinite', marginBottom: 12
                        }}></div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                          LOADING LIVE VIDEO STREAM...
                        </div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: 4 }}>
                          Connecting to {slot.camera.name} ({slot.camera.externalId})
                        </div>
                        <div className="mono" style={{ fontSize: '10px', color: '#64748b', marginTop: 6 }}>
                          Protocol: {slot.streamType === 'AI_ANNOTATED' ? 'Sentinel AI Inference (YOLOv11+ANPR)' : 'Direct Raw RTSP (TCP)'}
                        </div>
                      </div>
                    )}

                    {currentState === 'RECONNECTING' && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2, 6, 23, 0.96)',
                        zIndex: 10, padding: 16, textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                          ⚡ STREAM BUFFERING / RECONNECTING
                        </div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                          Sentinel AI is connecting to RTSP endpoint for {slot.camera.name}...
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: 12, fontSize: '10.5px' }}
                          onClick={() => setSlotStates((prev) => ({ ...prev, [index]: 'LOADING' }))}
                        >
                          🔄 Retry Stream Connection
                        </button>
                      </div>
                    )}

                    <img
                      key={`${slot.camera.id}-${slot.streamType}`}
                      src={slot.streamType === 'RAW'
                        ? `http://localhost:8000/api/v1/streams/${slot.camera.id}/raw_mjpeg`
                        : `http://localhost:8000/api/v1/streams/${slot.camera.id}/mjpeg`
                      }
                      alt={`${slot.streamType} - ${slot.camera.name}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onLoad={() => handleImageLoad(index)}
                      onError={() => handleImageError(index)}
                    />
                  </div>
                </>
              ) : (
                <div className="cell-empty-state" style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div>Slot {index + 1} Available</div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openCameraPicker(index)}
                  >
                    + Add Camera Feed
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Camera Selection Modal */}
      {cameraPickerSlot !== null && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Select Camera Feed for Slot {cameraPickerSlot + 1}</h3>
              <button className="modal-close" onClick={() => setCameraPickerSlot(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="filter-group" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Filter cameras by name, city, or external ID..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {loadingCameras ? (
                <div>Loading authorized camera catalogue...</div>
              ) : (
                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                  <table className="gov-table">
                    <thead>
                      <tr>
                        <th>Camera ID</th>
                        <th>Name</th>
                        <th>City</th>
                        <th>Dept</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableCameras
                        .filter((c) =>
                          c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.city.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.externalId.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                        .map((cam) => (
                          <tr key={cam.id}>
                            <td className="mono">{cam.externalId}</td>
                            <td><strong>{cam.name}</strong></td>
                            <td>{cam.city}</td>
                            <td>{cam.department}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => openCameraInSlot(cameraPickerSlot, cam, 'AI_ANNOTATED')}
                                >
                                  AI Stream
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openCameraInSlot(cameraPickerSlot, cam, 'RAW')}
                                >
                                  Raw
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCameraPickerSlot(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
