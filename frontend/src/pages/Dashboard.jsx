import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Camera, AlertTriangle, Shield, CheckCircle, Clock,
  Search as SearchIcon, ExternalLink, Activity, Map as MapIcon,
  Radio, Eye, ArrowRight, Crosshair, Video, WifiOff
} from 'lucide-react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { CameraMap } from '../map/CameraMap.jsx';

// ─── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1 }}>
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 3, letterSpacing: '0.04em' }}>
        {now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
      </div>
    </div>
  );
}

// ─── Compact KPI Block ─────────────────────────────────────────────────────────
function KpiBlock({ icon, label, value, sub, subColor, accentColor }) {
  return (
    <div className="kpi-block" style={{ borderLeft: `3px solid ${accentColor || 'var(--border-medium)'}` }}>
      <div style={{ color: accentColor || 'var(--text-muted)', flexShrink: 0, opacity: 0.8 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi-block-label">{label}</div>
        <div className="kpi-block-value">
          {value ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </div>
        {sub && (
          <div className="kpi-block-sub" style={{ color: subColor || 'var(--text-secondary)' }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Alert Row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, onClick }) {
  const severityColors = {
    CRITICAL: 'var(--status-critical)',
    HIGH: 'var(--status-warning)',
    MEDIUM: 'var(--accent-saffron)',
    LOW: 'var(--status-info)',
  };
  const color = severityColors[alert.severity] || 'var(--text-secondary)';
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-light)',
        display: 'grid',
        gridTemplateColumns: '6px 1fr auto',
        gap: 12,
        alignItems: 'center',
        cursor: 'pointer',
        background: alert.severity === 'CRITICAL' ? 'rgba(201,54,43,0.04)' : 'transparent',
        transition: 'background 0.15s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = alert.severity === 'CRITICAL' ? 'rgba(201,54,43,0.04)' : 'transparent'}
    >
      {/* Severity stripe */}
      <div style={{ width: 6, height: 40, borderRadius: 3, background: color, flexShrink: 0 }} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color, background: `${color}18`, padding: '1px 6px', borderRadius: 2 }}>
            {alert.severity}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.title}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Camera size={10} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[alert.cameraName, alert.cityName].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} />
      </div>
    </div>
  );
}

// ─── ANPR Detection Row ────────────────────────────────────────────────────────
function DetectionRow({ det }) {
  return (
    <tr>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {new Date(det.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </td>
      <td>
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {det.plateNumber || det.detectionType || '—'}
        </strong>
      </td>
      <td>
        <div style={{ fontSize: '12px', fontWeight: 500 }}>{det.cityName}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{det.cameraName}</div>
      </td>
      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {det.vehicleColor && det.vehicleType ? `${det.vehicleColor} ${det.vehicleType}` : '—'}
      </td>
      <td>
        {det.isWatchlistMatch ? (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            background: 'var(--status-critical)', color: '#fff',
            padding: '2px 7px', borderRadius: 2, letterSpacing: '0.05em'
          }}>HIT</span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            background: 'var(--status-success-bg)', color: 'var(--status-success)',
            border: '1px solid rgba(52,120,91,0.3)', padding: '2px 7px', borderRadius: 2
          }}>CLEAR</span>
        )}
      </td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
        {Math.round(det.confidence * 100)}%
      </td>
    </tr>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showModal } = useUI();

  const [summary, setSummary] = useState(null);
  const [recentDetections, setRecentDetections] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use the most recent detection event as the "live feed" reference
  const activeDetection = recentDetections.length > 0 ? recentDetections[0] : null;

  const loadDashboardData = useCallback(async () => {
    try {
      const [sumRes, detRes, alertRes, invRes] = await Promise.all([
        apiRequest('/cameras/summary'),
        apiRequest('/search?limit=8'),
        apiRequest('/alerts?limit=8&status=NEW'),
        apiRequest('/investigations?limit=20')
      ]);
      if (sumRes.success) setSummary(sumRes.data);
      if (detRes.success) setRecentDetections(detRes.data?.items || []);
      if (alertRes.success) setRecentAlerts(alertRes.data?.items || []);
      if (invRes.success) setInvestigations(invRes.data?.items || []);
    } catch (err) {
      console.error('Dashboard load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    // Refresh every 60 s to keep live feel
    const id = setInterval(loadDashboardData, 60_000);
    return () => clearInterval(id);
  }, [loadDashboardData]);

  function handleAlertClick(alertId) {
    showModal({
      title: 'Respond to Alert',
      message: 'Open the investigations workspace for this alert?',
      confirmText: 'Open Investigations',
      onConfirm: () => navigate('/investigations')
    });
  }

  const activeInvestigations = investigations.filter(inv => inv.status === 'ACTIVE');
  const criticalAlerts = recentAlerts.filter(a => a.severity === 'CRITICAL');
  const watchlistHits = recentDetections.filter(d => d.isWatchlistMatch);

  // offline / degraded counts from summary
  const offlineCount = summary ? (summary.totalCameras - summary.onlineCount) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--status-success)', boxShadow: '0 0 0 2px rgba(52,120,91,0.3)',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--status-success)', letterSpacing: '0.08em' }}>
              SYSTEM OPERATIONAL
            </span>
            {criticalAlerts.length > 0 && (
              <span className="badge badge-critical" style={{ animation: 'pulse 1.5s infinite' }}>
                {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <h1>POLICE INTELLIGENCE COMMAND CENTER</h1>
          <p>
            Statewide Video Surveillance · ANPR Intelligence · Real-Time Threat Monitoring
          </p>
        </div>
        <LiveClock />
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiBlock
          icon={<Video size={20} />}
          label="CCTV Online"
          value={summary?.onlineCount ?? '—'}
          sub={offlineCount != null ? `${offlineCount} offline` : undefined}
          subColor={offlineCount > 0 ? 'var(--status-critical)' : 'var(--status-success)'}
          accentColor="var(--status-success)"
        />
        <KpiBlock
          icon={<Activity size={20} />}
          label="AI Processing"
          value={summary?.aiProcessingCount ?? '—'}
          sub="Sentinel AI streams"
          accentColor="var(--status-info)"
        />
        <KpiBlock
          icon={<AlertTriangle size={20} />}
          label="Active Alerts"
          value={recentAlerts.length}
          sub={`${criticalAlerts.length} critical`}
          subColor={criticalAlerts.length > 0 ? 'var(--status-critical)' : 'var(--text-secondary)'}
          accentColor={criticalAlerts.length > 0 ? 'var(--status-critical)' : 'var(--accent-saffron)'}
        />
        <KpiBlock
          icon={<Shield size={20} />}
          label="Investigations"
          value={activeInvestigations.length}
          sub="active cases"
          accentColor="var(--accent-saffron)"
        />
        <KpiBlock
          icon={<Crosshair size={20} />}
          label="Watchlist Hits"
          value={watchlistHits.length}
          sub="last session"
          subColor={watchlistHits.length > 0 ? 'var(--status-critical)' : 'var(--text-secondary)'}
          accentColor={watchlistHits.length > 0 ? 'var(--status-critical)' : 'var(--border-medium)'}
        />
      </div>

      {/* ── MAIN COMMAND ROW: Map + Threats ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'stretch' }}>

        {/* GIS INTELLIGENCE MAP */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.01)'
          }}>
            <h2 style={{ fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em' }}>
              <MapIcon size={15} style={{ color: 'var(--brand-terracotta)' }} />
              GUJARAT SURVEILLANCE MAP
            </h2>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => navigate('/map')}
            >
              FULL GIS <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: 380 }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <CameraMap />
            </div>
          </div>
        </div>

        {/* ACTIVE THREATS PANEL */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'var(--status-critical)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '13px', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em' }}>
              <Radio size={14} style={{ animation: recentAlerts.length > 0 ? 'pulse 1.5s infinite' : 'none' }} />
              ACTIVE THREATS
            </h2>
            <NavLink to="/alerts" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ALL <ArrowRight size={12} />
            </NavLink>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recentAlerts.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={28} className="empty-state-icon" style={{ color: 'var(--status-success)' }} />
                <div className="empty-state-title">No Active Threats</div>
              </div>
            ) : (
              recentAlerts.map(alert => (
                <AlertRow key={alert.id} alert={alert} onClick={() => handleAlertClick(alert.id)} />
              ))
            )}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.01)' }}>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '11px', justifyContent: 'center', padding: '7px' }}
              onClick={() => navigate('/alerts')}
            >
              <Eye size={13} /> OPEN ALERT CENTER
            </button>
          </div>
        </div>
      </div>

      {/* ── LIVE SURVEILLANCE + ANPR ROW ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16 }}>

        {/* LIVE AI CAMERA PANEL */}
        <div style={{
          background: 'var(--structure-dark)',
          border: '1px solid var(--structure-darker)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '12px', margin: 0, color: '#A9B3BD', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.06em' }}>
              <Camera size={14} style={{ color: 'var(--brand-terracotta)' }} />
              LIVE AI SURVEILLANCE
            </h2>
            {activeDetection && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                color: 'var(--status-success)', background: 'rgba(52,120,91,0.15)',
                border: '1px solid rgba(52,120,91,0.4)', padding: '2px 8px', borderRadius: 2
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-success)', animation: 'pulse 1.5s infinite' }} />
                LIVE
              </span>
            )}
          </div>

          {/* Camera viewport */}
          <div style={{ position: 'relative', flex: 1, minHeight: 240, background: '#090D16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeDetection ? (
              <>
                {/* Try to show actual stream; hide if it errors */}
                <img
                  src={`http://localhost:8000/api/v1/streams/${activeDetection.cameraId}/mjpeg`}
                  alt="live feed"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
                {/* ANPR highlight box */}
                <div style={{
                  position: 'absolute', top: '28%', left: '30%',
                  border: '2px solid var(--status-success)',
                  padding: '8px 14px',
                  background: 'rgba(0,0,0,0.6)',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: 'rgba(52,120,91,0.8)', letterSpacing: '0.1em', marginBottom: 2 }}>TARGET ACQUIRED</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>{activeDetection.plateNumber}</div>
                  <div style={{ fontSize: '10px', color: 'var(--status-success)' }}>{Math.round(activeDetection.confidence * 100)}% CONF</div>
                </div>

                {/* OSD top-left */}
                <div style={{ position: 'absolute', top: 10, left: 12, fontFamily: 'var(--font-mono)', color: '#fff', textShadow: '0 1px 4px #000' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{activeDetection.cameraName}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)' }}>{activeDetection.cityName}</div>
                </div>
                {/* OSD bottom-left */}
                <div style={{ position: 'absolute', bottom: 10, left: 12, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--status-success)', fontWeight: 700 }}>
                  <Activity size={11} style={{ display: 'inline', marginRight: 4 }} />SENTINEL AI ACTIVE
                </div>
                {/* OSD bottom-right */}
                <div style={{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                  {new Date(activeDetection.detectedAt).toLocaleTimeString()}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#4A5568' }}>
                <WifiOff size={30} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em' }}>
                  {loading ? 'INITIALIZING...' : 'AWAITING FEED'}
                </span>
              </div>
            )}
          </div>

          {/* Quick-link to Live Matrix */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#A9B3BD', padding: '7px' }}
              onClick={() => navigate('/live')}
            >
              <Grid size={13} /> OPEN LIVE MATRIX
            </button>
          </div>
        </div>

        {/* RECENT ANPR INTELLIGENCE TABLE */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.01)'
          }}>
            <h2 style={{ fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em' }}>
              <SearchIcon size={14} style={{ color: 'var(--brand-terracotta)' }} />
              RECENT ANPR INTELLIGENCE
            </h2>
            <NavLink to="/search" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-info)' }}>
              FULL LOG <ExternalLink size={11} />
            </NavLink>
          </div>

          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {['TIME', 'PLATE', 'LOCATION', 'VEHICLE', 'STATUS', 'CONF'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontFamily: 'var(--font-heading)', fontSize: '10px',
                      fontWeight: 700, color: 'var(--text-secondary)',
                      letterSpacing: '0.07em', background: 'rgba(0,0,0,0.02)',
                      whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDetections.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {loading ? 'Initialising intelligence feed…' : 'No recent detection events.'}
                    </td>
                  </tr>
                ) : (
                  recentDetections.map(det => <DetectionRow key={det.id} det={det} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}

// Need Grid icon separately since it's used in the Live panel quick-link button
function Grid(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={props.style}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
