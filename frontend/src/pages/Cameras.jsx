import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import {
  Video, Wifi, WifiOff, Activity, Search, Plus, Filter,
  MapPin, Shield, Zap, ExternalLink, ChevronLeft, ChevronRight,
  AlertTriangle, X, Clock, CheckCircle, Radio
} from 'lucide-react';

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  ACTIVE:      'var(--status-success)',
  OFFLINE:     'var(--status-critical)',
  DEGRADED:    'var(--status-warning)',
  CONNECTING:  'var(--status-info)',
};
const STATUS_BG = {
  ACTIVE:      'var(--status-success-bg)',
  OFFLINE:     'var(--status-critical-bg)',
  DEGRADED:    'var(--status-warning-bg)',
  CONNECTING:  'var(--status-info-bg)',
};
const AI_COLOR = {
  PROCESSING: 'var(--status-success)',
  ERROR:      'var(--status-critical)',
  IDLE:       'var(--text-muted)',
  STOPPED:    'var(--text-muted)',
};

function StatusDot({ status, size = 8 }) {
  const c = STATUS_COLOR[status] || 'var(--text-muted)';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: c, flexShrink: 0,
      boxShadow: status === 'ACTIVE' ? `0 0 0 2px ${c}30` : 'none',
      animation: status === 'ACTIVE' ? 'pulse 2.5s infinite' : 'none'
    }} />
  );
}

function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || 'var(--text-muted)';
  const bg = STATUS_BG[status] || 'rgba(0,0,0,0.05)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
      background: bg, color: c, border: `1px solid ${c}40`,
      padding: '2px 8px', borderRadius: 2, letterSpacing: '0.06em', whiteSpace: 'nowrap'
    }}>
      {status}
    </span>
  );
}

// ─── KPI Block ─────────────────────────────────────────────────────────────────
function KpiBlock({ icon, label, value, accentColor }) {
  return (
    <div className="kpi-block" style={{ borderLeft: `3px solid ${accentColor || 'var(--border-medium)'}` }}>
      <div style={{ color: accentColor || 'var(--text-muted)', flexShrink: 0, opacity: 0.8 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi-block-label">{label}</div>
        <div className="kpi-block-value">
          {value ?? '—'}
        </div>
      </div>
    </div>
  );
}

// ─── Camera Grid Card ──────────────────────────────────────────────────────────
function CameraCard({ cam, selected, onClick }) {
  const isOnline = cam.status === 'ACTIVE';
  const isOffline = cam.status === 'OFFLINE';
  const stripeColor = STATUS_COLOR[cam.status] || 'var(--border-medium)';
  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? 'var(--accent-saffron)' : 'var(--border-light)'}`,
        cursor: 'pointer',
        padding: '14px 14px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        borderLeft: selected ? '3px solid var(--accent-saffron)' : `3px solid ${stripeColor}`,
        background: selected ? 'rgba(229,138,36,0.06)' : 'var(--bg-surface)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-surface)'; }}
    >

      {/* Top: status + AI indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusDot status={cam.status} />
          <StatusPill status={cam.status} />
        </div>
        {cam.aiStatus === 'PROCESSING' && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
            color: 'var(--status-success)', background: 'var(--status-success-bg)',
            border: '1px solid rgba(52,120,91,0.3)', padding: '1px 6px', borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', animation: 'pulse 1.5s infinite' }} />
            AI LIVE
          </span>
        )}
      </div>

      {/* Camera name */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cam.name}
        </div>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
          {cam.externalId}
        </div>
      </div>

      {/* Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--text-secondary)' }}>
        <MapPin size={10} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cam.location || cam.city}
        </span>
      </div>

      {/* Bottom: dept + offline time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-light)' }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)',
          background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-light)',
          padding: '1px 6px', borderRadius: 2, letterSpacing: '0.04em'
        }}>
          {cam.departmentCode || cam.department || '—'}
        </span>
        {isOffline && cam.lastSeenAt && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--status-critical)' }}>
            <WifiOff size={10} style={{ display: 'inline', marginRight: 3 }} />
            {new Date(cam.lastSeenAt).toLocaleDateString()}
          </span>
        )}
        {isOnline && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--status-success)' }}>
            STREAMING
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Camera Detail Panel ───────────────────────────────────────────────────────
function CameraDetail({ cam, onOpenLiveStream, onStartAI, onDelete, onRequestAccess, user, isStateAdmin, isDeptHead }) {
  if (!cam) {
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <Video size={40} className="empty-state-icon" />
        <div className="empty-state-title">Select a camera from the grid to view intelligence.</div>
      </div>
    );
  }

  const isOnline = cam.status === 'ACTIVE';
  const stripeColor = STATUS_COLOR[cam.status] || 'var(--border-medium)';
  const ownCamera = isStateAdmin || cam.departmentId === user?.departmentId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'var(--structure-dark)', color: '#fff',
        padding: '18px 20px', borderBottom: `3px solid ${stripeColor}`, flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusDot status={cam.status} size={10} />
            <StatusPill status={cam.status} />
            {cam.aiStatus && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                color: AI_COLOR[cam.aiStatus] || 'var(--text-muted)',
                letterSpacing: '0.06em'
              }}>
                AI: {cam.aiStatus}
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7A87', letterSpacing: '0.06em' }}>
            {cam.externalId}
          </div>
        </div>

        <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{cam.name}</h2>
        <div style={{ fontSize: '12px', color: '#9BA3AB', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={11} />
          {cam.location}
          {cam.city && <><span>·</span>{cam.city}</>}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Viewport / Stream */}
        {isOnline ? (
          <section>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
              Live Stream Preview
            </div>
            <div style={{
              background: 'var(--structure-dark)', position: 'relative',
              aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', borderRadius: 2
            }}>
              <img
                src={`http://localhost:8000/api/v1/streams/${cam.id}/mjpeg`}
                alt="live stream"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div style={{ position: 'absolute', top: 8, left: 10, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-success)', animation: 'pulse 1.5s infinite' }} />
                  LIVE
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 8, right: 10, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                {new Date().toLocaleTimeString()}
              </div>
              {/* Fallback (shown when stream fails) */}
              <div style={{ color: '#475569', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Video size={24} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>CONNECTING...</span>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
              Stream Status
            </div>
            <div style={{
              background: 'var(--status-critical-bg)', border: '1px solid rgba(201,54,43,0.3)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 2
            }}>
              <WifiOff size={18} style={{ color: 'var(--status-critical)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--status-critical)' }}>STREAM UNAVAILABLE</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Status: {cam.status}
                  {cam.lastSeenAt && <span> · Last active: {new Date(cam.lastSeenAt).toLocaleString('en-IN')}</span>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Camera Specification */}
        <section>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
            Asset Specification
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Camera ID', value: cam.externalId, mono: true },
              { label: 'Stream Protocol', value: cam.streamProtocol || 'RTSP' },
              { label: 'Department', value: cam.department || cam.departmentCode || '—' },
              { label: 'City', value: cam.city || '—' },
              { label: 'AI Engine', value: cam.aiStatus || '—' },
              { label: 'Coordinates', value: cam.latitude && cam.longitude ? `${cam.latitude?.toFixed(4)}, ${cam.longitude?.toFixed(4)}` : '—', mono: true },
            ].map(f => (
              <div key={f.label} style={{
                background: 'var(--bg-main)', border: '1px solid var(--border-light)',
                padding: '9px 12px', borderRadius: 2
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: f.mono ? 'var(--font-mono)' : 'var(--font-body)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 12, textTransform: 'uppercase' }}>
            Operational Actions
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isOnline && (
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onOpenLiveStream && onOpenLiveStream(cam)}
              >
                <Video size={14} /> OPEN IN LIVE MATRIX
              </button>
            )}

            {cam.aiStatus !== 'PROCESSING' && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onStartAI(cam)}
              >
                <Zap size={14} /> START SENTINEL AI
              </button>
            )}

            {!ownCamera && !isStateAdmin && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onRequestAccess(cam)}
              >
                <Shield size={14} /> REQUEST ACCESS
              </button>
            )}

            {(isStateAdmin || (isDeptHead && cam.departmentId === user?.departmentId)) && (
              <button
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', background: 'transparent', color: 'var(--status-critical)', border: '1px solid rgba(201,54,43,0.4)' }}
                onClick={() => onDelete(cam)}
              >
                <X size={14} /> DECOMMISSION ASSET
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Register Camera Modal ─────────────────────────────────────────────────────
function RegisterModal({ regForm, setRegForm, cities, departments, isStateAdmin, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="system-modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, fontSize: '14px', letterSpacing: '0.04em' }}>REGISTER NEW SURVEILLANCE ASSET</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>External Camera ID *</label>
              <input type="text" className="form-control" required placeholder="e.g. GJ-AMD-POL-101"
                value={regForm.externalId}
                onChange={e => setRegForm({ ...regForm, externalId: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Camera Number</label>
              <input type="text" className="form-control" placeholder="e.g. 101"
                value={regForm.cameraNumber}
                onChange={e => setRegForm({ ...regForm, cameraNumber: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Camera Name *</label>
              <input type="text" className="form-control" required placeholder="e.g. Kalupur Railway Station East Junction"
                value={regForm.name}
                onChange={e => setRegForm({ ...regForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>City *</label>
              <select className="form-control" required value={regForm.cityId}
                onChange={e => setRegForm({ ...regForm, cityId: e.target.value })}>
                <option value="">Select City</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.district})</option>)}
              </select>
            </div>
            {isStateAdmin && (
              <div className="form-group">
                <label>Managing Department</label>
                <select className="form-control" value={regForm.departmentId}
                  onChange={e => setRegForm({ ...regForm, departmentId: e.target.value })}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Location Description *</label>
              <input type="text" className="form-control" required placeholder="e.g. Sector 11 Secretariat Entry Gate 1, Gandhinagar"
                value={regForm.location}
                onChange={e => setRegForm({ ...regForm, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Stream Protocol</label>
              <select className="form-control" value={regForm.streamProtocol}
                onChange={e => setRegForm({ ...regForm, streamProtocol: e.target.value })}>
                <option value="RTSP">RTSP Stream</option>
                <option value="HTTPS-HLS">HTTPS / HLS Stream</option>
              </select>
            </div>
            <div className="form-group">
              <label>Stream URI</label>
              <input type="text" className="form-control" placeholder="rtsp://10.20.1.101:554/live"
                value={regForm.streamReference}
                onChange={e => setRegForm({ ...regForm, streamReference: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Latitude (Gujarat: 20.0–24.5)</label>
              <input type="text" className="form-control" placeholder="23.0225"
                value={regForm.latitude}
                onChange={e => setRegForm({ ...regForm, latitude: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Longitude (Gujarat: 68.0–74.5)</label>
              <input type="text" className="form-control" placeholder="72.5714"
                value={regForm.longitude}
                onChange={e => setRegForm({ ...regForm, longitude: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary">REGISTER ASSET</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Access Request Modal ──────────────────────────────────────────────────────
function AccessModal({ cam, accessForm, setAccessForm, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="system-modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, fontSize: '14px', letterSpacing: '0.04em' }}>REQUEST INTER-DEPT CAMERA ACCESS</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', padding: '12px 14px', borderRadius: 2 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Target Camera</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cam.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                {cam.department} · {cam.city}
              </div>
            </div>
            <div className="form-group">
              <label>Access Duration *</label>
              <select className="form-control" value={accessForm.duration}
                onChange={e => setAccessForm({ ...accessForm, duration: e.target.value })}>
                <option value="TEMPORARY">Temporary Grant (Time-bound)</option>
                <option value="PERMANENT">Permanent Grant</option>
              </select>
            </div>
            {accessForm.duration === 'TEMPORARY' && (
              <div className="form-group">
                <label>Expiration Date *</label>
                <input type="date" className="form-control" required
                  value={accessForm.expiresAt}
                  onChange={e => setAccessForm({ ...accessForm, expiresAt: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label>Official Justification *</label>
              <textarea className="form-control" required rows={3}
                placeholder="State the official investigation or operational necessity..."
                value={accessForm.reason}
                onChange={e => setAccessForm({ ...accessForm, reason: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary">SUBMIT REQUEST</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function CamerasPage({ onOpenLiveStream }) {
  const { user, isStateAdmin, isDeptHead } = useAuth();
  const { showToast, showModal } = useUI();

  const [cameras, setCameras] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [cities, setCities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedCamera, setSelectedCamera] = useState(null);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [cameraForAccess, setCameraForAccess] = useState(null);

  const [regForm, setRegForm] = useState({
    externalId: '', cameraNumber: '', name: '', departmentId: '',
    cityId: '', location: '', streamProtocol: 'RTSP', streamReference: '',
    latitude: '', longitude: ''
  });
  const [accessForm, setAccessForm] = useState({ duration: 'TEMPORARY', reason: '', expiresAt: '' });

  useEffect(() => { loadLookups(); }, []);
  useEffect(() => { loadCameras(); }, [page, selectedCity, selectedDept, selectedStatus, searchQuery]);

  async function loadLookups() {
    try {
      const [citiesRes, deptRes] = await Promise.all([
        apiRequest('/cities'),
        apiRequest('/departments')
      ]);
      if (citiesRes.success) setCities(citiesRes.data || []);
      if (deptRes.success) setDepartments(deptRes.data || []);
    } catch (err) {
      console.error('Failed to load lookups:', err.message);
    }
  }

  const loadCameras = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit, offset: page * limit,
        ...(selectedCity && { city: selectedCity }),
        ...(selectedDept && { departmentId: selectedDept }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(searchQuery && { search: searchQuery })
      });
      const res = await apiRequest(`/cameras?${params}`);
      if (res.success && res.data) {
        setCameras(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load cameras:', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedCity, selectedDept, selectedStatus, searchQuery]);

  async function handleRegisterCamera(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/cameras', {
        method: 'POST',
        body: {
          ...regForm,
          latitude: regForm.latitude ? Number(regForm.latitude) : undefined,
          longitude: regForm.longitude ? Number(regForm.longitude) : undefined
        }
      });
      if (res.success) {
        showToast('Camera registered. Initial status: CONNECTING.', 'success');
        setShowRegisterModal(false);
        setRegForm({ externalId: '', cameraNumber: '', name: '', departmentId: '', cityId: '', location: '', streamProtocol: 'RTSP', streamReference: '', latitude: '', longitude: '' });
        loadCameras();
      }
    } catch (err) {
      showToast(`Registration failed: ${err.message}`, 'danger');
    }
  }

  function handleStartAI(cam) {
    showModal({
      title: 'Start Sentinel AI',
      message: `Launch AI inference (YOLO + ANPR) on "${cam.name}"?`,
      confirmText: 'Start AI',
      onConfirm: async () => {
        try {
          const res = await apiRequest('/ai/jobs', { method: 'POST', body: { cameraId: cam.id } });
          if (res.success) {
            showToast(`AI inference started on ${cam.name}.`, 'success');
            loadCameras();
          }
        } catch (err) {
          showToast(`Failed to start AI job: ${err.message}`, 'danger');
        }
      }
    });
  }

  function handleDelete(cam) {
    showModal({
      title: 'Decommission Camera Asset',
      message: `Are you sure you want to permanently decommission "${cam.name}" (${cam.externalId})? This action cannot be undone.`,
      confirmText: 'Decommission',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/cameras/${cam.id}`, { method: 'DELETE' });
          if (res.success) {
            showToast(`Camera "${cam.name}" decommissioned.`, 'success');
            setSelectedCamera(null);
            loadCameras();
          }
        } catch (err) {
          showToast(`Failed to decommission: ${err.message}`, 'danger');
        }
      }
    });
  }

  function handleRequestAccess(cam) {
    setCameraForAccess(cam);
    setAccessForm({ duration: 'TEMPORARY', reason: '', expiresAt: '' });
    setShowAccessModal(true);
  }

  async function handleSubmitAccessRequest(e) {
    e.preventDefault();
    if (!cameraForAccess) return;
    try {
      const res = await apiRequest('/access-requests', {
        method: 'POST',
        body: {
          cameraIds: [cameraForAccess.id],
          duration: accessForm.duration,
          reason: accessForm.reason,
          expiresAt: accessForm.duration === 'TEMPORARY' ? new Date(accessForm.expiresAt).toISOString() : null
        }
      });
      if (res.success) {
        showToast('Access request submitted successfully.', 'success');
        setShowAccessModal(false);
        setCameraForAccess(null);
      }
    } catch (err) {
      showToast(`Access request failed: ${err.message}`, 'danger');
    }
  }

  function openRegisterModal() {
    setRegForm({
      externalId: '', cameraNumber: '', name: '',
      departmentId: user.departmentId || (departments[0]?.id || ''),
      cityId: cities[0]?.id || '',
      location: '', streamProtocol: 'RTSP', streamReference: '', latitude: '', longitude: ''
    });
    setShowRegisterModal(true);
  }

  const totalPages = Math.ceil(total / limit);
  const onlineCount = cameras.filter(c => c.status === 'ACTIVE').length;
  const offlineCount = cameras.filter(c => c.status === 'OFFLINE').length;
  const degradedCount = cameras.filter(c => c.status === 'DEGRADED').length;
  const aiCount = cameras.filter(c => c.aiStatus === 'PROCESSING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Radio size={13} style={{ color: 'var(--status-success)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--status-success)', letterSpacing: '0.08em' }}>
              {onlineCount} CAMERAS STREAMING
            </span>
          </div>
          <h1>CCTV SURVEILLANCE CENTER</h1>
          <p>
            Statewide video surveillance asset management · AI inference monitoring · Access control
          </p>
        </div>
        {(isStateAdmin || isDeptHead) && (
          <button className="btn btn-primary" onClick={openRegisterModal}>
            <Plus size={14} /> REGISTER CAMERA
          </button>
        )}
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiBlock icon={<Video size={18} />} label="Total (This Page)" value={cameras.length} accentColor="var(--status-info)" />
        <KpiBlock icon={<Wifi size={18} />} label="Online" value={onlineCount} accentColor="var(--status-success)" />
        <KpiBlock icon={<WifiOff size={18} />} label="Offline / Degraded" value={offlineCount + degradedCount} accentColor={offlineCount > 0 ? 'var(--status-critical)' : 'var(--border-medium)'} />
        <KpiBlock icon={<Activity size={18} />} label="AI Processing" value={aiCount} accentColor="var(--accent-saffron)" />
      </div>

      {/* ── FILTER BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
        padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search ID, name, location…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            style={{ paddingLeft: 32, fontSize: '13px', minWidth: 0, width: '100%' }}
          />
        </div>
        <select className="form-control" value={selectedCity}
          onChange={e => { setSelectedCity(e.target.value); setPage(0); }}
          style={{ fontSize: '12px', minWidth: 130 }}>
          <option value="">All Cities</option>
          {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select className="form-control" value={selectedDept}
          onChange={e => { setSelectedDept(e.target.value); setPage(0); }}
          style={{ fontSize: '12px', minWidth: 140 }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
        </select>
        <select className="form-control" value={selectedStatus}
          onChange={e => { setSelectedStatus(e.target.value); setPage(0); }}
          style={{ fontSize: '12px', minWidth: 130 }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="OFFLINE">OFFLINE</option>
          <option value="DEGRADED">DEGRADED</option>
          <option value="CONNECTING">CONNECTING</option>
        </select>
        {(selectedCity || selectedDept || selectedStatus || searchQuery) && (
          <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 10px', whiteSpace: 'nowrap' }}
            onClick={() => { setSelectedCity(''); setSelectedDept(''); setSelectedStatus(''); setSearchQuery(''); setPage(0); }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* ── MAIN SPLIT: Grid | Detail ────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 360px', gap: 0,
        border: '1px solid var(--border-light)', flex: 1, minHeight: 0, overflow: 'hidden'
      }}>

        {/* LEFT: Camera Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.01)', flexShrink: 0
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : `${cameras.length} cameras · ${total} total`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                  PAGE {page + 1}/{totalPages}
                </span>
                <button className="btn btn-secondary" disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  style={{ padding: '3px 7px', fontSize: '11px' }}>
                  <ChevronLeft size={13} />
                </button>
                <button className="btn btn-secondary" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '3px 7px', fontSize: '11px' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {loading ? (
              <div className="empty-state">Loading surveillance assets…</div>
            ) : cameras.length === 0 ? (
              <div className="empty-state">
                <Video size={28} className="empty-state-icon" />
                <div className="empty-state-title">No cameras match your current filters.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {cameras.map(cam => (
                  <CameraCard
                    key={cam.id}
                    cam={cam}
                    selected={selectedCamera?.id === cam.id}
                    onClick={() => setSelectedCamera(cam)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <CameraDetail
          cam={selectedCamera}
          onOpenLiveStream={onOpenLiveStream}
          onStartAI={handleStartAI}
          onDelete={handleDelete}
          onRequestAccess={handleRequestAccess}
          user={user}
          isStateAdmin={isStateAdmin}
          isDeptHead={isDeptHead}
        />
      </div>

      {/* ── Modals ── */}
      {showRegisterModal && (
        <RegisterModal
          regForm={regForm} setRegForm={setRegForm}
          cities={cities} departments={departments}
          isStateAdmin={isStateAdmin}
          onSubmit={handleRegisterCamera}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
      {showAccessModal && cameraForAccess && (
        <AccessModal
          cam={cameraForAccess}
          accessForm={accessForm} setAccessForm={setAccessForm}
          onSubmit={handleSubmitAccessRequest}
          onClose={() => setShowAccessModal(false)}
        />
      )}
    </div>
  );
}
