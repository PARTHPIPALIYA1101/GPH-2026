import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api.js';
import { useUI } from '../contexts/UIContext.jsx';
import { Plus, X, Activity, Video, AlertCircle, Search as SearchIcon, Radio, Zap } from 'lucide-react';

const SLOTS_STORAGE_KEY = 'gov_live_slots';
const GRID_STORAGE_KEY  = 'gov_live_grid';

function loadSavedSlots() {
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : Array(16).fill(null);
  } catch { return Array(16).fill(null); }
}

function loadSavedGrid() {
  try {
    const raw = localStorage.getItem(GRID_STORAGE_KEY);
    return raw ? Number(raw) : 4;
  } catch { return 4; }
}

function sinceMs(ts) {
  if (!ts) return null;
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'JUST NOW' : `${m}m`;
}

export function LiveMatrix({ initialCamera = null }) {
  const { showToast, showModal } = useUI();
  const [gridSize, setGridSize] = useState(loadSavedGrid);
  
  const [slots, setSlots] = useState(() => Array(16).fill(null));
  const [slotStates, setSlotStates] = useState({});
  const slotsRef = useRef(slots);
  
  useEffect(() => { slotsRef.current = slots; }, [slots]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [cameraPickerSlot, setCameraPickerSlot] = useState(null);
  const [availableCameras, setAvailableCameras]  = useState([]);
  const [loadingCameras, setLoadingCameras]       = useState(false);
  const [searchFilter, setSearchFilter]           = useState('');
  const [activeSessionStats, setActiveSessionStats] = useState({ activeViews: 0, maxViews: 16 });

  useEffect(() => { localStorage.setItem(GRID_STORAGE_KEY, String(gridSize)); }, [gridSize]);

  useEffect(() => {
    const toSave = slots.map((s) =>
      s?.camera ? { camera: s.camera, streamType: s.streamType, startedAt: s.startedAt } : null
    );
    localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(toSave));
  }, [slots]);

  // Robust initialization and unmount cleanup
  useEffect(() => {
    let active = true;

    async function init() {
      loadSessionStats();
      const saved = loadSavedSlots();
      if (initialCamera) {
         saved[0] = { camera: initialCamera, streamType: 'AI_ANNOTATED' };
      }
      
      const promises = saved.map(async (s, i) => {
        if (s && s.camera && active) {
          // If initial load asks for AI, we ensure the job is requested
          if (s.streamType === 'AI_ANNOTATED') {
             try { await apiRequest('/ai/jobs', { method: 'POST', body: { cameraId: s.camera.id } }); } catch (e) {}
          }
          await openCameraInSlot(i, s.camera, s.streamType || 'AI_ANNOTATED', true);
        }
      });
      await Promise.all(promises);
    }

    init();

    return () => {
      active = false;
      // Release all sessions on unmount
      slotsRef.current.forEach(slot => {
        if (slot?.session?.sessionId) {
          apiRequest('/streams/session/release', { method: 'POST', body: { sessionId: slot.session.sessionId } }).catch(() => {});
        }
      });
    };
    // eslint-disable-next-line
  }, [initialCamera?.id]);

  async function loadSessionStats() {
    try {
      const res = await apiRequest('/streams/stats');
      if (res.success && res.data && mountedRef.current) setActiveSessionStats(res.data);
    } catch { /* Fallback */ }
  }

  async function openCameraPicker(slotIndex) {
    setCameraPickerSlot(slotIndex);
    setLoadingCameras(true);
    setSearchFilter('');
    try {
      const res = await apiRequest('/cameras?limit=100');
      if (res.success && res.data && mountedRef.current) setAvailableCameras(res.data.items || []);
    } catch (err) {
      if (mountedRef.current) showToast(`Failed to load cameras: ${err.message}`, 'danger');
    } finally {
      if (mountedRef.current) setLoadingCameras(false);
    }
  }

  async function handlePickerSelect(cam, streamType) {
    if (streamType === 'AI_ANNOTATED') {
      try {
        const aiRes = await apiRequest('/ai/jobs', { method: 'POST', body: { cameraId: cam.id } });
        if (!aiRes.success) throw new Error(aiRes.message || 'Failed to start AI job');
      } catch (err) {
        showToast(`AI Activation failed: ${err.message}`, 'danger');
        return; // Don't add camera if AI fails
      }
    }
    await openCameraInSlot(cameraPickerSlot, cam, streamType, false);
  }

  async function openCameraInSlot(slotIndex, camera, streamType = 'AI_ANNOTATED', quiet = false) {
    // 1. Release existing session in this slot if any
    const existingSlot = slotsRef.current[slotIndex];
    if (existingSlot?.session?.sessionId) {
      try {
        await apiRequest('/streams/session/release', { method: 'POST', body: { sessionId: existingSlot.session.sessionId } });
      } catch (e) {}
    }

    setSlotStates((prev) => ({ ...prev, [slotIndex]: 'LOADING' }));
    
    // Optimistically set the slot
    setSlots((prev) => {
      const u = [...prev];
      u[slotIndex] = { camera, session: null, streamType, startedAt: Date.now() };
      return u;
    });

    try {
      const res = await apiRequest('/streams/session', {
        method: 'POST',
        body: { cameraId: camera.id, streamType }
      });

      if (!mountedRef.current) {
        if (res.success && res.data?.sessionId) {
          apiRequest('/streams/session/release', { method: 'POST', body: { sessionId: res.data.sessionId } }).catch(()=>{});
        }
        return;
      }

      if (res.success && res.data) {
        setSlots((prev) => {
          const updated = [...prev];
          const currentInSlot = updated[slotIndex];
          
          if (currentInSlot?.camera?.id === camera.id && currentInSlot?.streamType === streamType) {
            // Overwriting a session that somehow snuck in? Release it.
            if (currentInSlot.session?.sessionId) {
              apiRequest('/streams/session/release', { method: 'POST', body: { sessionId: currentInSlot.session.sessionId } }).catch(()=>{});
            }
            updated[slotIndex] = { ...currentInSlot, session: res.data };
          } else {
            // Orphaned session due to race conditions or slot changes
            apiRequest('/streams/session/release', { method: 'POST', body: { sessionId: res.data.sessionId } }).catch(()=>{});
          }
          return updated;
        });
        setCameraPickerSlot(null);
        loadSessionStats();
        if (!quiet) showToast(`${camera.externalId} stream connected.`, 'success');
      } else {
        throw new Error(res.message || 'Failed to authorize stream');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (!quiet) showToast(`Stream auth failed: ${err.message}`, 'danger');
      setSlotStates((prev) => ({ ...prev, [slotIndex]: 'ERROR' }));
      setSlots((prev) => {
        const updated = [...prev];
        if (updated[slotIndex]?.camera?.id === camera.id && updated[slotIndex]?.streamType === streamType) {
          updated[slotIndex] = null;
        }
        return updated;
      });
    }
  }

  function handleImageLoad(index) {
    setSlotStates((prev) => ({ ...prev, [index]: 'CONNECTED' }));
  }

  function handleImageError(index) {
    setSlotStates((prev) => ({ ...prev, [index]: 'RECONNECTING' }));
  }

  async function closeSlotStream(slotIndex) {
    const slot = slotsRef.current[slotIndex];
    if (!slot) return;
    
    if (slot.session?.sessionId) {
      try {
        await apiRequest('/streams/session/release', {
          method: 'POST',
          body: { sessionId: slot.session.sessionId }
        });
      } catch (e) {}
    }
    
    setSlots((prev) => {
      const u = [...prev];
      u[slotIndex] = null;
      return u;
    });
    setSlotStates((prev) => {
      const u = { ...prev };
      delete u[slotIndex];
      return u;
    });
    loadSessionStats();
  }

  async function toggleStreamType(slotIndex) {
    const slot = slotsRef.current[slotIndex];
    if (!slot) return;
    
    const targetType = slot.streamType === 'AI_ANNOTATED' ? 'RAW' : 'AI_ANNOTATED';
    
    if (targetType === 'AI_ANNOTATED') {
      try {
        const aiRes = await apiRequest('/ai/jobs', { method: 'POST', body: { cameraId: slot.camera.id } });
        if (!aiRes.success) throw new Error(aiRes.message || 'Failed to start AI job');
        showToast(`Sentinel AI activated for ${slot.camera.externalId}`, 'success');
      } catch (err) {
        showToast(`AI Activation failed: ${err.message}`, 'danger');
        return;
      }
    }
    
    await openCameraInSlot(slotIndex, slot.camera, targetType, false);
  }

  function confirmClearAll() {
    showModal({
      title: 'Clear All Feeds',
      message: 'Are you sure you want to disconnect all active camera sessions?',
      confirmText: 'Clear All',
      type: 'danger',
      onConfirm: () => {
        slotsRef.current.forEach((_, idx) => closeSlotStream(idx));
      }
    });
  }

  const visibleSlots = slots.slice(0, gridSize);
  const activeVisibleCount = visibleSlots.filter(s => s && s.session && s.session.sessionId).length;

  const GRIDS = [
    { size: 1, label: '1×1' },
    { size: 4, label: '2×2' },
    { size: 9, label: '3×3' },
    { size: 16, label: '4×4' },
  ];

  const filteredCameras = availableCameras.filter((c) =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.city?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.externalId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Controls Bar ── */}
      <div className="live-matrix-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Grid presets */}
          <div style={{ display: 'flex', gap: 4 }}>
            {GRIDS.map((g) => (
              <button
                key={g.size}
                className={`btn ${gridSize === g.size ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '5px 12px', fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                onClick={() => setGridSize(g.size)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={confirmClearAll}
            style={{ padding: '5px 12px', fontSize: '12px' }}
          >
            <X size={12} /> CLEAR ALL
          </button>
        </div>

        {/* Feed status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <Radio size={12} style={{ color: activeVisibleCount > 0 ? 'var(--status-success)' : 'var(--text-muted)', animation: activeVisibleCount > 0 ? 'pulse 2s infinite' : 'none' }} />
            <strong style={{ color: 'var(--text-primary)' }}>{activeVisibleCount}</strong>
            &nbsp;/ {gridSize} FEEDS ACTIVE
          </div>
          {activeSessionStats?.activeViews != null && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
              SERVER: {activeSessionStats.activeViews}/{activeSessionStats.maxViews} SESSIONS
            </div>
          )}
        </div>
      </div>

      {/* ── Surveillance Wall ── */}
      <div className={`matrix-grid matrix-grid-${gridSize}`}>
        {visibleSlots.map((slot, index) => {
          const state = slotStates[index] || (slot ? 'LOADING' : 'IDLE');
          return (
            <div
              key={index}
              className="video-cell"
              onMouseEnter={e => { if (!slot) e.currentTarget.querySelector('.cell-empty-state')?.setAttribute('style', 'background:rgba(255,255,255,0.05)'); }}
            >
              {slot ? (
                <>
                  {/* OSD TOP */}
                  <div className="video-cell-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: state === 'CONNECTED' ? 'var(--status-success)' : state === 'RECONNECTING' ? 'var(--status-warning)' : 'var(--status-info)',
                        boxShadow: state === 'CONNECTED' ? '0 0 5px var(--status-success)' : 'none',
                        animation: state !== 'CONNECTED' ? 'pulse 1.5s infinite' : 'none'
                      }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: '#fff', letterSpacing: '0.05em', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                        {slot.camera.externalId}
                      </span>
                      {slot.camera.city && (
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>· {slot.camera.city}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        title="Toggle AI / RAW"
                        onClick={() => toggleStreamType(index)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                          background: slot.streamType === 'AI_ANNOTATED' ? 'rgba(52,120,91,0.75)' : 'rgba(57,120,140,0.75)',
                          color: '#fff', padding: '1px 6px', borderRadius: 2, letterSpacing: '0.06em',
                          cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
                          userSelect: 'none'
                        }}>
                        {slot.streamType === 'AI_ANNOTATED' ? 'AI' : 'RAW'}
                      </span>
                      <button
                        onClick={() => closeSlotStream(index)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', padding: '2px', display: 'flex', lineHeight: 1 }}
                        title="Remove feed"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  {/* VIDEO */}
                  <div className="video-cell-screen">
                    {(state === 'LOADING') && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: 10, display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(9,13,22,0.93)', color: 'var(--status-info)', gap: 8
                      }}>
                        <Activity size={22} style={{ animation: 'pulse 1.5s infinite' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em' }}>INITIALIZING</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#687078' }}>{slot.camera.externalId}</span>
                      </div>
                    )}
                    {(state === 'RECONNECTING') && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: 10, display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(9,13,22,0.93)', color: 'var(--status-warning)', gap: 8
                      }}>
                        <AlertCircle size={22} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em' }}>BUFFERING</span>
                        <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '10px', marginTop: 4 }}
                          onClick={() => setSlotStates((p) => ({ ...p, [index]: 'LOADING' }))}>
                          RETRY
                        </button>
                      </div>
                    )}
                    <img
                      key={`${slot.camera.id}-${slot.streamType}-${slot.session?.sessionId || 'loading'}`}
                      src={
                        slot.streamType === 'RAW'
                          ? `http://localhost:8000/api/v1/streams/${slot.camera.id}/raw_mjpeg?session=${slot.session?.sessionId || ''}`
                          : `http://localhost:8000/api/v1/streams/${slot.camera.id}/mjpeg?session=${slot.session?.sessionId || ''}`
                      }
                      alt={`${slot.streamType} feed`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onLoad={() => handleImageLoad(index)}
                      onError={() => handleImageError(index)}
                    />
                  </div>

                  {/* OSD BOTTOM */}
                  <div className="video-cell-footer">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      {slot.camera.location || slot.camera.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: slot.streamType === 'AI_ANNOTATED' ? 'rgba(52,200,120,0.75)' : 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {slot.streamType === 'AI_ANNOTATED' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />}
                      {slot.streamType === 'AI_ANNOTATED' ? 'SENTINEL AI' : 'RAW RTSP'}
                    </span>
                  </div>
                </>
              ) : (
                /* Empty slot */
                <div className="cell-empty-state" onClick={() => openCameraPicker(index)}>
                  <Video size={18} style={{ opacity: 0.35 }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', color: '#4A5568', textTransform: 'uppercase' }}>
                    SLOT {String(index + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: '10px', fontWeight: 600,
                    color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                    padding: '3px 10px', borderRadius: 2
                  }}>
                    <Plus size={11} /> ADD FEED
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Camera Picker Modal ── */}
      {cameraPickerSlot !== null && (
        <div className="modal-backdrop" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-content system-modal assign-camera-modal" style={{ maxWidth: 680, background: '#FFFDF8', border: '1px solid #D1CEC5', borderRadius: 4, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
            {/* Dark header */}
            <div className="modal-header" style={{ background: '#0F172A', borderBottom: '2px solid #E58A24', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#F8FAFC', margin: 0, fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}>
                  ASSIGN CAMERA — SLOT {String(cameraPickerSlot + 1).padStart(2, '0')}
                </h3>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#94A3B8', marginTop: 2 }}>
                  Select a camera and stream type to connect
                </div>
              </div>
              <button className="modal-close" onClick={() => setCameraPickerSlot(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Light body */}
            <div className="modal-body" style={{ padding: '16px 20px', background: '#FFFDF8' }}>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: 11, color: '#687078' }} />
                <input
                  type="text"
                  placeholder="Search by ID, name, or city…"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: '13px', width: '100%', background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', borderRadius: 3, outline: 'none' }}
                />
              </div>

              {loadingCameras ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#687078', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  LOADING CAMERA INDEX...
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto', borderRadius: 3, border: '1px solid #D1CEC5', background: '#FFFFFF' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F4F1EA', borderBottom: '1px solid #D1CEC5' }}>
                        <th style={{ color: '#687078', padding: '10px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>Camera ID</th>
                        <th style={{ color: '#687078', padding: '10px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>Name / Location</th>
                        <th style={{ color: '#687078', padding: '10px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>Status</th>
                        <th style={{ color: '#687078', padding: '10px 12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textAlign: 'right' }}>Stream Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCameras.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: '#687078' }}>No cameras found.</td></tr>
                      ) : (
                        filteredCameras.map((cam) => (
                          <tr
                            key={cam.id}
                            style={{ borderBottom: '1px solid #E0DDD5', background: '#FFFFFF', transition: 'background 0.15s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#F0EDE5'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                          >
                            <td className="mono" style={{ fontSize: '12px', fontWeight: 700, color: '#E58A24', padding: '10px 12px' }}>{cam.externalId}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: '#171A1C' }}>{cam.name}</div>
                              <div style={{ fontSize: '11px', color: '#687078' }}>{cam.city}</div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                                color: cam.status === 'ACTIVE' ? '#34785B' : '#C9362B',
                                background: cam.status === 'ACTIVE' ? 'rgba(52,120,91,0.1)' : 'rgba(201,54,43,0.1)',
                                border: `1px solid ${cam.status === 'ACTIVE' ? 'rgba(52,120,91,0.3)' : 'rgba(201,54,43,0.3)'}`,
                                padding: '2px 7px', borderRadius: 2
                              }}>
                                {cam.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button
                                  style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, background: '#B54A2A', border: 'none', color: '#ffffff', borderRadius: 2, cursor: cam.status === 'ACTIVE' ? 'pointer' : 'not-allowed', opacity: cam.status === 'ACTIVE' ? 1 : 0.5 }}
                                  onClick={() => handlePickerSelect(cam, 'AI_ANNOTATED')}
                                  disabled={cam.status !== 'ACTIVE'}
                                >
                                  AI STREAM
                                </button>
                                <button
                                  style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, background: '#334155', border: '1px solid #475569', color: '#FFFFFF', borderRadius: 2, cursor: cam.status === 'ACTIVE' ? 'pointer' : 'not-allowed', opacity: cam.status === 'ACTIVE' ? 1 : 0.5 }}
                                  onClick={() => handlePickerSelect(cam, 'RAW')}
                                  disabled={cam.status !== 'ACTIVE'}
                                >
                                  RAW RTSP
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Light footer */}
            <div className="modal-footer" style={{ background: '#F4F1EA', borderTop: '1px solid #D1CEC5', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', padding: '6px 16px', fontSize: '11px', fontWeight: 600, borderRadius: 2, cursor: 'pointer' }} onClick={() => setCameraPickerSlot(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
