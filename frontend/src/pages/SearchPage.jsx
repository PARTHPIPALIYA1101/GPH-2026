import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useUI } from '../contexts/UIContext.jsx';
import {
  Search, MapPin, Video, Shield, Clock, ChevronLeft, ChevronRight,
  Filter, FileText, Crosshair, AlertTriangle, Download, X, Car,
  Activity, CheckCircle, Eye
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

function confClass(conf) {
  if (conf >= 0.85) return 'anpr-conf-high';
  if (conf >= 0.65) return 'anpr-conf-medium';
  return 'anpr-conf-low';
}
function confBarColor(conf) {
  if (conf >= 0.85) return 'var(--status-success)';
  if (conf >= 0.65) return 'var(--accent-saffron)';
  return 'var(--status-warning)';
}

// ─── Info Field Component ─────────────────────────────────────────────────────
function InfoField({ icon, label, value }) {
  return (
    <div className="anpr-info-field">
      <div className="anpr-info-field-label">{icon} {label}</div>
      <div className="anpr-info-field-value">{value || '—'}</div>
    </div>
  );
}

// ─── Detection Row ────────────────────────────────────────────────────────────
function DetectionRow({ det, selected, onClick }) {
  const conf = Math.round(det.confidence * 100);
  const barColor = confBarColor(det.confidence);
  const vehicleDesc = [det.vehicleColor, det.vehicleType].filter(Boolean).join(' ') || 'Unknown Vehicle';

  return (
    <div
      onClick={onClick}
      className={`anpr-det-row${selected ? ' anpr-det-row--selected' : ''}`}
    >
      <div className="anpr-det-bar" style={{ background: selected ? 'transparent' : barColor }} />
      <div className="anpr-det-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
          <span className="anpr-plate">{det.plateNumber || 'UNKNOWN'}</span>
          <span className={`anpr-conf-badge ${confClass(det.confidence)}`}>{conf}%</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 5 }}>
          {vehicleDesc}
        </div>
        <div className="anpr-det-meta">
          <Video size={10} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{det.cameraName}</span>
          <span style={{ color: 'var(--border-medium)' }}>·</span>
          <Clock size={10} style={{ flexShrink: 0 }} />
          <span>{elapsed(det.detectedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Active Filter Chips ──────────────────────────────────────────────────────
function FilterChips({ plateNumber, vehicleType, vehicleColor, detectionType, selectedCity, cities, dateFrom, dateTo, onClear }) {
  const chips = [];
  if (plateNumber) chips.push({ key: 'plate', label: `PLATE: ${plateNumber}`, onRemove: () => onClear('plate') });
  if (vehicleType) chips.push({ key: 'type', label: `TYPE: ${vehicleType}`, onRemove: () => onClear('type') });
  if (vehicleColor) chips.push({ key: 'color', label: `COLOR: ${vehicleColor}`, onRemove: () => onClear('color') });
  if (detectionType) chips.push({ key: 'detType', label: `DETECTION: ${detectionType}`, onRemove: () => onClear('detType') });
  if (selectedCity) {
    const city = cities.find(c => String(c.id) === String(selectedCity));
    chips.push({ key: 'city', label: `CITY: ${city?.name || selectedCity}`, onRemove: () => onClear('city') });
  }
  if (dateFrom) chips.push({ key: 'from', label: `FROM: ${dateFrom}`, onRemove: () => onClear('from') });
  if (dateTo) chips.push({ key: 'to', label: `TO: ${dateTo}`, onRemove: () => onClear('to') });

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border-light)', background: 'rgba(229,138,36,0.03)', flexShrink: 0 }}>
      {chips.map(chip => (
        <span key={chip.key} className="filter-chip">
          {chip.label}
          <button className="filter-chip-close" onClick={chip.onRemove} title={`Remove ${chip.label}`}>
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SearchPage() {
  const { showToast } = useUI();
  const [plateNumber, setPlateNumber]     = useState('');
  const [vehicleType, setVehicleType]     = useState('');
  const [vehicleColor, setVehicleColor]   = useState('');
  const [detectionType, setDetectionType] = useState('');
  const [selectedCity, setSelectedCity]   = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  const [cities, setCities]   = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(0);
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
        ...(plateNumber    && { plateNumber }),
        ...(vehicleType    && { vehicleType }),
        ...(vehicleColor   && { vehicleColor }),
        ...(detectionType  && { detectionType }),
        ...(selectedCity   && { cityId: selectedCity }),
        ...(dateFrom       && { dateFrom }),
        ...(dateTo         && { dateTo }),
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
      showToast(`Search query failed: ${err.message}`, 'danger');
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
          metadata: { plateNumber: det.plateNumber, confidence: det.confidence, time: det.detectedAt },
        },
      });
      if (res.success) {
        showToast(`Evidence record created with SHA256 integrity hash: ${res.data.hashSha256.slice(0, 16)}...`, 'success');
      }
    } catch (err) {
      showToast(`Failed to export evidence: ${err.message}`, 'danger');
    }
  }

  function clearFilter(key) {
    const map = {
      plate: () => setPlateNumber(''),
      type: () => setVehicleType(''),
      color: () => setVehicleColor(''),
      detType: () => setDetectionType(''),
      city: () => setSelectedCity(''),
      from: () => setDateFrom(''),
      to: () => setDateTo(''),
    };
    map[key]?.();
  }

  const hasActiveFilters = plateNumber || vehicleType || vehicleColor || detectionType || selectedCity || dateFrom || dateTo;
  const totalPages = Math.ceil(total / limit);
  const conf = selectedDetection ? Math.round(selectedDetection.confidence * 100) : 0;
  const confColor = selectedDetection ? confBarColor(selectedDetection.confidence) : 'var(--border-medium)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <Activity size={13} style={{ color: 'var(--accent-saffron)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--accent-saffron)', letterSpacing: '0.09em' }}>
              AUTOMATED NUMBER PLATE RECOGNITION
            </span>
          </div>
          <h1>VEHICLE INTELLIGENCE CENTER</h1>
          <p>Search historical ANPR captures by plate, vehicle attributes, camera source, date range and confidence threshold.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={13} />
            {showFilters ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      <div className="anpr-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div className="kpi-block" style={{ borderLeft: '3px solid var(--status-info)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="kpi-block-label">TOTAL CAPTURES</div>
            <div className="kpi-block-value">{loading && total === 0 ? '...' : total.toLocaleString()}</div>
          </div>
        </div>
        <div className="kpi-block" style={{ borderLeft: `3px solid ${hasActiveFilters ? 'var(--accent-saffron)' : 'var(--border-medium)'}` }}>
          <div style={{ minWidth: 0 }}>
            <div className="kpi-block-label">ACTIVE FILTERS</div>
            <div className="kpi-block-value" style={{ fontSize: '22px' }}>
              {hasActiveFilters ? (
                <span style={{ color: 'var(--accent-saffron)' }}>
                  {[plateNumber, vehicleType, vehicleColor, detectionType, selectedCity, dateFrom, dateTo].filter(Boolean).length}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-body)', fontWeight: 600 }}>NONE</span>
              )}
            </div>
          </div>
        </div>
        <div className="kpi-block" style={{ borderLeft: '3px solid var(--status-success)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="kpi-block-label">MIN CONFIDENCE</div>
            <div className="kpi-block-value">{Math.round(minConfidence * 100)}%</div>
          </div>
        </div>
        <div className="kpi-block" style={{ borderLeft: '3px solid var(--text-muted)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="kpi-block-label">PAGE</div>
            <div className="kpi-block-value" style={{ fontSize: '22px' }}>
              {total > 0 ? `${page + 1} / ${totalPages}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── ADVANCED FILTERS PANEL ──────────────────────────────────────────── */}
      {showFilters && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderLeft: '3px solid var(--accent-saffron)', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 }}>
            SEARCH PARAMETERS
          </div>
          <div className="anpr-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label>License Plate</label>
              <input type="text" className="form-control" placeholder="e.g. GJ01AB1234" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vehicle Type</label>
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
            <div className="form-group">
              <label>Vehicle Color</label>
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
            <div className="form-group">
              <label>City Scope</label>
              <select className="form-control" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">All Authorized Cities</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date From</label>
              <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date To</label>
              <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Detection Type</label>
              <select className="form-control" value={detectionType} onChange={(e) => setDetectionType(e.target.value)}>
                <option value="">All Detection Types</option>
                <option value="ANPR">ANPR</option>
                <option value="WATCHLIST_HIT">Watchlist Hit</option>
                <option value="ALERT">Alert</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 1' }}>
              <label>Min AI Confidence: {Math.round(minConfidence * 100)}%</label>
              <input
                type="range" min="0.3" max="0.99" step="0.05"
                value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))}
                style={{ width: '100%', marginTop: 10, accentColor: 'var(--accent-saffron)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {hasActiveFilters && (
              <button className="btn btn-secondary" onClick={() => {
                setPlateNumber(''); setVehicleType(''); setVehicleColor('');
                setDetectionType(''); setSelectedCity(''); setDateFrom(''); setDateTo('');
              }}>
                <X size={13} /> Clear All
              </button>
            )}
            <button className="btn btn-primary" onClick={() => performSearch(0)}>
              <Search size={13} /> Execute Search
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN SPLIT: QUEUE | DETAIL ──────────────────────────────────────── */}
      <div className="anpr-split-view" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 0, flex: 1, border: '1px solid var(--border-light)', background: 'var(--bg-surface)', minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Detection List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', overflow: 'hidden' }}>

          {/* Quick Search (shown when filters panel is hidden) */}
          {!showFilters && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'rgba(0,0,0,0.01)' }}>
              <form onSubmit={(e) => { e.preventDefault(); performSearch(0); }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Quick search by licence plate…"
                    value={plateNumber}
                    onChange={e => setPlateNumber(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: '13px', minWidth: 0, width: '100%' }}
                  />
                </div>
              </form>
            </div>
          )}

          {/* Active filter chips */}
          <FilterChips
            plateNumber={plateNumber} vehicleType={vehicleType} vehicleColor={vehicleColor}
            detectionType={detectionType} selectedCity={selectedCity} cities={cities}
            dateFrom={dateFrom} dateTo={dateTo}
            onClear={clearFilter}
          />

          {/* List header */}
          <div style={{
            padding: '7px 14px', borderBottom: '1px solid var(--border-light)', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.015)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              DETECTIONS
            </span>
            {loading
              ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-saffron)' }}>QUERYING…</span>
              : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{total.toLocaleString()} RECORDS</span>
            }
          </div>

          {/* Scrollable detection list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && results.length === 0 ? (
              <div className="empty-state">
                <Activity size={28} className="empty-state-icon" style={{ animation: 'pulse 1.5s infinite' }} />
                <div className="empty-state-title">Executing query…</div>
              </div>
            ) : results.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={28} className="empty-state-icon" />
                <div className="empty-state-title">No detections found</div>
                <div className="empty-state-desc">Try adjusting the search parameters or confidence threshold.</div>
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
              padding: '9px 14px', borderTop: '1px solid var(--border-light)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(0,0,0,0.01)', flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                PAGE {page + 1} / {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => performSearch(page - 1)}>
                  <ChevronLeft size={12} />
                </button>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => performSearch(page + 1)}>
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Intelligence Dossier ── */}
        {!selectedDetection ? (
          <div className="empty-state anpr-detail-panel" style={{ flex: 1 }}>
            <Crosshair size={36} className="empty-state-icon" />
            <div className="empty-state-title">SELECT A VEHICLE DETECTION</div>
            <div className="empty-state-desc">
              Select a detection record from the list to display vehicle intelligence, historical sightings, and operational context.
            </div>
          </div>
        ) : (
          <div className="anpr-detail-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── DOSSIER HEADER ── */}
            <div style={{
              background: 'var(--structure-dark)',
              color: '#fff',
              padding: '20px 24px',
              borderBottom: `3px solid ${confColor}`,
              flexShrink: 0,
            }}>
              {/* Labels row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                    background: 'var(--status-info-bg)', color: 'var(--status-info)',
                    border: '1px solid var(--status-info)', padding: '2px 8px', borderRadius: 2, letterSpacing: '0.06em',
                  }}>ANPR DETECTION</span>
                  <span className={`anpr-conf-badge ${confClass(selectedDetection.confidence)}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                    {conf}% CONFIDENCE
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7A87', letterSpacing: '0.06em' }}>
                  DET-ID: {String(selectedDetection.id).split('-')[0].toUpperCase()}
                </span>
              </div>

              {/* Plate — primary identifier */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '30px', fontWeight: 800, color: 'var(--accent-saffron)', letterSpacing: '0.06em', lineHeight: 1, marginBottom: 8 }}>
                {selectedDetection.plateNumber || 'UNKNOWN PLATE'}
              </div>

              {/* Vehicle description */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#9BA3AB' }}>
                <Car size={13} />
                {[selectedDetection.vehicleColor, selectedDetection.vehicleType].filter(Boolean).join(' ') || 'Vehicle attributes unavailable'}
              </div>

              {/* Confidence bar */}
              <div className="anpr-conf-bar-track" style={{ marginTop: 14 }}>
                <div className="anpr-conf-bar-fill" style={{ width: `${conf}%`, background: confColor }} />
              </div>
            </div>

            {/* ── SCROLLABLE INTELLIGENCE BODY ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* OBSERVATION & LOCATION */}
              <section>
                <div className="intel-section-label">Observation &amp; Location</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <InfoField icon={<Clock size={11} />} label="Detected At" value={new Date(selectedDetection.detectedAt).toLocaleString('en-IN')} />
                  <InfoField icon={<MapPin size={11} />} label="City / Region" value={selectedDetection.cityName} />
                  <InfoField icon={<Video size={11} />} label="Camera Feed" value={selectedDetection.cameraName} />
                  <InfoField icon={<MapPin size={11} />} label="Location" value={selectedDetection.cameraLocation} />
                  <InfoField icon={<Shield size={11} />} label="Department Code" value={selectedDetection.departmentCode} />
                </div>
              </section>

              {/* SYSTEM INTELLIGENCE */}
              <section>
                <div className="intel-section-label">System Intelligence</div>
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>AI Classification</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--status-success)', fontWeight: 700 }}>VERIFIED</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Plate Confidence Score</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: confColor, fontWeight: 700 }}>{conf}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Alert / Watchlist Status</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      NOT FLAGGED (DEFAULT)
                    </span>
                  </div>
                </div>
              </section>

              {/* OPERATIONAL ACTIONS */}
              <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 4 }}>
                <div className="intel-section-label" style={{ marginBottom: 12 }}>Operational Actions</div>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                  onClick={() => handleExportEvidence(selectedDetection)}
                >
                  <Download size={14} /> EXPORT EVIDENCE &amp; LOG
                </button>
              </section>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
