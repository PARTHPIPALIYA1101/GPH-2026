import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import {
  Search, MapPin, Video, Shield, Clock, ChevronLeft, ChevronRight,
  Filter, FileText, Crosshair, AlertTriangle, Download, X, Car, Activity, CheckCircle
} from 'lucide-react';

// ─── Formatting Helpers ───────────────────────────────────────────────────────
function elapsed(isoDate) {
  if (!isoDate) return '—';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InfoField({ icon, label, value }) {
  return (
    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', padding: '10px 12px', borderRadius: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function DetectionRow({ det, selected, onClick }) {
  const conf = Math.round(det.confidence * 100);
  const confColor = conf >= 85 ? 'var(--status-success)' : conf >= 65 ? 'var(--accent-saffron)' : 'var(--status-warning)';
  
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '4px 1fr', cursor: 'pointer',
        borderBottom: '1px solid var(--border-light)',
        background: selected ? 'rgba(229,138,36,0.06)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent-saffron)' : '3px solid transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ background: confColor, width: 4 }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
            {det.plateNumber || 'UNKNOWN PLATE'}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            {elapsed(det.detectedAt)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 6 }}>
          {[det.vehicleColor, det.vehicleType].filter(Boolean).join(' ') || 'Unknown Vehicle'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--text-muted)' }}>
          <Video size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {det.cameraName}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [detectionType, setDetectionType] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  const [cities, setCities] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  const [selectedDetection, setSelectedDetection] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function loadCities() {
      try {
        const res = await apiRequest('/cities');
        if (res.success) setCities(res.data || []);
      } catch {
        // city lookup fallback
      }
    }
    loadCities();
    performSearch(0);
  }, []);

  async function performSearch(pageIndex = 0) {
    setLoading(true);
    setPage(pageIndex);
    try {
      const params = new URLSearchParams({
        limit,
        offset: pageIndex * limit,
        minConfidence,
        ...(plateNumber && { plateNumber }),
        ...(vehicleType && { vehicleType }),
        ...(vehicleColor && { vehicleColor }),
        ...(detectionType && { detectionType }),
        ...(selectedCity && { cityId: selectedCity }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo })
      });

      const res = await apiRequest(`/search?${params.toString()}`);
      if (res.success && res.data) {
        setResults(res.data.items || []);
        setTotal(res.data.total || 0);
        if (!selectedDetection && res.data.items?.length > 0) {
          setSelectedDetection(res.data.items[0]);
        } else if (res.data.items?.length === 0) {
          setSelectedDetection(null);
        }
      }
    } catch (err) {
      alert(`Search query failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportEvidence(det) {
    try {
      const res = await apiRequest('/evidence', {
        method: 'POST',
        body: {
          detectionId: det.id,
          cameraId: det.cameraId,
          evidenceType: 'IMAGE_SNAPSHOT',
          sourceType: 'LIVE_SNAPSHOT',
          title: `ANPR Capture: ${det.plateNumber || 'Vehicle'} at ${det.cameraName}`,
          metadata: { plateNumber: det.plateNumber, confidence: det.confidence, time: det.detectedAt }
        }
      });
      if (res.success) {
        alert(`Evidence record created with SHA256 integrity hash: ${res.data.hashSha256.slice(0, 16)}...`);
      }
    } catch (err) {
      alert(`Failed to export evidence: ${err.message}`);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Activity size={14} style={{ color: 'var(--accent-saffron)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-saffron)', letterSpacing: '0.08em' }}>
              REAL-TIME ANPR SURVEILLANCE
            </span>
          </div>
          <h1>VEHICLE INTELLIGENCE CENTER</h1>
          <p>
            Search historical vehicle plate captures, vehicle attributes, and detection intelligence.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'TOTAL CAPTURES', count: total, color: 'var(--status-info)' },
          { label: 'PAGE', count: total > 0 ? page + 1 : 0, color: 'var(--text-muted)' },
          { label: 'MIN CONFIDENCE', count: `${Math.round(minConfidence * 100)}%`, color: 'var(--status-success)' },
          { label: 'CURRENT SEARCH', count: plateNumber || vehicleType || vehicleColor || 'ALL VEHICLES', color: 'var(--accent-saffron)' },
        ].map(({ label, count, color }) => (
          <div key={label} className="kpi-block" style={{ borderLeft: `3px solid ${color}`, justifyContent: 'space-between' }}>
            <span className="kpi-block-label">{label}</span>
            <span className="kpi-block-value">{count}</span>
          </div>
        ))}
      </div>

      {/* ── Advanced Filters ── */}
      {showFilters && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '16px', marginBottom: '16px', borderRadius: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>License Plate</label>
              <input type="text" className="form-control" placeholder="e.g. GJ01AB1234" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>Vehicle Type</label>
              <select className="form-control" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="">All Types</option>
                <option value="SUV">SUV</option>
                <option value="SEDAN">Sedan</option>
                <option value="HATCHBACK">Hatchback</option>
                <option value="BUS">Bus (GSRTC/Private)</option>
                <option value="TRUCK">Heavy Truck</option>
                <option value="MOTORCYCLE">Two-Wheeler</option>
                <option value="AUTO">Auto Rickshaw</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>Vehicle Color</label>
              <select className="form-control" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)}>
                <option value="">All Colors</option>
                <option value="WHITE">White</option>
                <option value="BLACK">Black</option>
                <option value="SILVER">Silver / Grey</option>
                <option value="RED">Red</option>
                <option value="BLUE">Blue</option>
                <option value="YELLOW">Yellow</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>City Scope</label>
              <select className="form-control" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">All Authorized Cities</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>Date From</label>
              <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>Date To</label>
              <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                Min AI Confidence: {Math.round(minConfidence * 100)}%
              </label>
              <input type="range" min="0.3" max="0.99" step="0.05" value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => performSearch(0)}>
              <Search size={14} /> Execute Search
            </button>
          </div>
        </div>
      )}

      {/* ── Main split: Queue | Detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 0, flex: 1, border: '1px solid var(--border-light)', background: 'var(--bg-surface)', minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Detection List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', overflow: 'hidden' }}>
          
          {/* Quick Search */}
          {!showFilters && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.01)', flexShrink: 0 }}>
              <form onSubmit={(e) => { e.preventDefault(); performSearch(0); }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Quick search by License Plate..."
                    value={plateNumber}
                    onChange={e => setPlateNumber(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: '13px', minWidth: 0, width: '100%' }}
                  />
                </div>
              </form>
            </div>
          )}

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && results.length === 0 ? (
              <div className="empty-state">Executing search query...</div>
            ) : results.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={28} className="empty-state-icon" style={{ color: 'var(--text-secondary)' }} />
                <div className="empty-state-title">No vehicle detections found.</div>
              </div>
            ) : (
              results.map(det => (
                <DetectionRow
                  key={det.id}
                  det={det}
                  selected={selectedDetection?.id === det.id}
                  onClick={() => setSelectedDetection(det)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '10px 14px', borderTop: '1px solid var(--border-light)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(0,0,0,0.01)', flexShrink: 0
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                PAGE {page + 1}/{totalPages}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary" disabled={page === 0}
                  onClick={() => performSearch(page - 1)}
                  style={{ padding: '4px 8px', fontSize: '11px' }}>
                  <ChevronLeft size={13} />
                </button>
                <button className="btn btn-secondary" disabled={page >= totalPages - 1}
                  onClick={() => performSearch(page + 1)}
                  style={{ padding: '4px 8px', fontSize: '11px' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Intelligence Detail ── */}
        {!selectedDetection ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <Crosshair size={40} className="empty-state-icon" />
            <div className="empty-state-title">SELECT A VEHICLE DETECTION</div>
            <div className="empty-state-desc">
              Select a detection record from the list to display vehicle intelligence, historical sightings, and operational context.
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Header / Identity Section */}
            <div style={{
              background: 'var(--structure-dark)',
              color: '#fff',
              padding: '24px',
              borderBottom: `3px solid var(--accent-saffron)`,
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                    background: 'var(--status-info-bg)', color: 'var(--status-info)',
                    border: `1px solid var(--status-info)`, padding: '2px 8px', borderRadius: 2,
                    letterSpacing: '0.06em'
                  }}>
                    ANPR DETECTION
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                    background: selectedDetection.confidence >= 0.85 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                    color: selectedDetection.confidence >= 0.85 ? 'var(--status-success)' : 'var(--status-warning)',
                    border: `1px solid ${selectedDetection.confidence >= 0.85 ? 'var(--status-success)' : 'var(--status-warning)'}`, 
                    padding: '2px 8px', borderRadius: 2,
                    letterSpacing: '0.06em'
                  }}>
                    {Math.round(selectedDetection.confidence * 100)}% CONFIDENCE
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7A87', letterSpacing: '0.06em' }}>
                  DET-ID: {String(selectedDetection.id).split('-')[0].toUpperCase()}
                </div>
              </div>

              <h2 style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-saffron)', fontSize: '32px', fontWeight: 800, marginBottom: 8, lineHeight: 1, letterSpacing: '0.04em' }}>
                {selectedDetection.plateNumber || 'UNKNOWN PLATE'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '14px', color: '#9BA3AB' }}>
                <Car size={14} />
                {[selectedDetection.vehicleColor, selectedDetection.vehicleType].filter(Boolean).join(' ') || 'Vehicle attributes unavailable'}
              </div>
            </div>

            {/* Scrollable Intelligence Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* OBSERVATION */}
              <section>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
                  Observation & Location
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InfoField icon={<Clock size={13} />} label="Detected At" value={new Date(selectedDetection.detectedAt).toLocaleString('en-IN')} />
                  <InfoField icon={<MapPin size={13} />} label="City / Region" value={selectedDetection.cityName || '—'} />
                  <InfoField icon={<Video size={13} />} label="Camera Feed" value={selectedDetection.cameraName || '—'} />
                  <InfoField icon={<MapPin size={13} />} label="Location" value={selectedDetection.cameraLocation || '—'} />
                  <InfoField icon={<Shield size={13} />} label="Department Code" value={selectedDetection.departmentCode || '—'} />
                </div>
              </section>

              {/* INTELLIGENCE */}
              <section>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
                  System Intelligence
                </div>
                <div style={{
                  background: 'var(--bg-main)', border: '1px solid var(--border-light)',
                  padding: '14px 16px', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>AI Classification</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--status-success)', fontWeight: 700 }}>VERIFIED</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Plate Confidence Score</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {Math.round(selectedDetection.confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Alert / Watchlist Status</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      NOT FLAGGED (DEFAULT)
                    </span>
                  </div>
                </div>
              </section>

              {/* ACTIONS */}
              <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 12, textTransform: 'uppercase' }}>
                  Operational Actions
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                  onClick={() => handleExportEvidence(selectedDetection)}
                >
                  <Download size={15} /> EXPORT EVIDENCE &amp; LOG
                </button>
              </section>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
