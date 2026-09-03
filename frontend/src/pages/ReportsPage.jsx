import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { CameraMap } from '../map/CameraMap.jsx';
import {
  Activity, Radio, Shield, CheckCircle, Map as MapIcon,
  BarChart2, PieChart, FileText, Download, Target, Video,
  FolderKanban, AlertTriangle
} from 'lucide-react';

// ─── KPI Component ─────────────────────────────────────────────────────────────
function KpiBlock({ icon, label, value, sub, accentColor }) {
  return (
    <div className="kpi-block" style={{ borderLeft: `3px solid ${accentColor || 'var(--border-medium)'}` }}>
      <div style={{ color: accentColor || 'var(--text-muted)', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi-block-label">{label}</div>
        <div className="kpi-block-value">
          {value ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </div>
        {sub && (
          <div className="kpi-block-sub" style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Native CSS Distribution Bar ───────────────────────────────────────────────
function DistributionBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.05em' }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{count} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span></span>
      </div>
      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.8s ease-out' }} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ReportsPage() {
  // Original reporting state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    reportType: 'CAMERA_HEALTH',
    format: 'CSV'
  });

  // Analytics state
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [investigationsTotal, setInvestigationsTotal] = useState(0);
  const [anprTotal, setAnprTotal] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    loadReports();
    loadAnalytics();
  }, []);

  // ─── Analytics Load ───
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const [sumRes, alertsRes, invRes, anprRes] = await Promise.all([
        apiRequest('/cameras/summary').catch(() => null),
        apiRequest('/alerts?limit=500').catch(() => null),
        apiRequest('/investigations?limit=1').catch(() => null),
        apiRequest('/search?limit=1').catch(() => null)
      ]);
      
      if (sumRes?.success) setSummary(sumRes.data);
      if (alertsRes?.success) setAlerts(alertsRes.data.items || []);
      if (invRes?.success) setInvestigationsTotal(invRes.data.total || 0);
      if (anprRes?.success) setAnprTotal(anprRes.data.total || 0);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  // ─── Reports Load & Handlers (Preserved from old implementation) ───
  async function loadReports() {
    setReportsLoading(true);
    try {
      const res = await apiRequest('/reports');
      if (res.success && res.data) {
        setReports(res.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err.message);
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/reports', {
        method: 'POST',
        body: form
      });
      if (res.success) {
        alert('Report generation job queued asynchronously.');
        setShowGenerateModal(false);
        setForm({ title: '', reportType: 'CAMERA_HEALTH', format: 'CSV' });
        setTimeout(loadReports, 1000);
      }
    } catch (err) {
      alert(`Report request failed: ${err.message}`);
    }
  }

  function handleDownload(reportId, title, format) {
    const token = localStorage.getItem('gov_auth_token');
    fetch(`/api/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}.${format.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert(err.message));
  }

  // ─── Data Aggregation for Analytics ───
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const statusCounts = { NEW: 0, ACKNOWLEDGED: 0, RESOLVED: 0 };

  alerts.forEach(a => {
    if (severityCounts[a.severity] !== undefined) severityCounts[a.severity]++;
    if (statusCounts[a.status] !== undefined) statusCounts[a.status]++;
  });

  const totalAlerts = alerts.length || 1; // Used for percentages
  const offlineCount = summary ? (summary.totalCameras - summary.onlineCount) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      
      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h1>POLICE CRIME INTELLIGENCE &amp; ANALYTICS CENTER</h1>
          <p>
            Statewide Threat Analysis · Incident Distributions · Geographic Intelligence · Operational Reporting
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => document.getElementById('operational-reporting')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <FileText size={15} style={{ marginRight: 6 }}/> GENERATE REPORT
        </button>
      </div>

      {/* ── KEY INTELLIGENCE OVERVIEW (KPIs) ── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 10, textTransform: 'uppercase' }}>
          KEY INTELLIGENCE OVERVIEW
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <KpiBlock 
            icon={<Radio size={24} />} 
            label="Total Alerts" 
            value={analyticsLoading ? '...' : alerts.length} 
            accentColor="var(--status-warning)" 
          />
          <KpiBlock 
            icon={<Activity size={24} />} 
            label="Active Critical" 
            value={analyticsLoading ? '...' : severityCounts.CRITICAL} 
            accentColor="var(--status-critical)" 
          />
          <KpiBlock 
            icon={<FolderKanban size={24} />} 
            label="Active Cases" 
            value={analyticsLoading ? '...' : investigationsTotal} 
            accentColor="var(--accent-saffron)" 
          />
          <KpiBlock 
            icon={<Video size={24} />} 
            label="Cameras Online" 
            value={analyticsLoading ? '...' : summary?.onlineCount} 
            sub={offlineCount != null ? `${offlineCount} offline` : undefined}
            accentColor="var(--status-success)" 
          />
          <KpiBlock 
            icon={<Target size={24} />} 
            label="Total ANPR Captures" 
            value={analyticsLoading ? '...' : anprTotal} 
            accentColor="var(--status-info)" 
          />
        </div>
      </div>

      {/* ── ALERT DISTRIBUTION & GEOGRAPHIC INTELLIGENCE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        
        {/* Dist Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: 20 }}>
            <h2 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px 0', letterSpacing: '0.05em' }}>
              <BarChart2 size={16} style={{ color: 'var(--brand-terracotta)' }} /> INCIDENT SEVERITY DISTRIBUTION
            </h2>
            <DistributionBar label="CRITICAL THREATS" count={severityCounts.CRITICAL} total={totalAlerts} color="var(--status-critical)" />
            <DistributionBar label="HIGH SEVERITY" count={severityCounts.HIGH} total={totalAlerts} color="var(--status-warning)" />
            <DistributionBar label="MEDIUM SEVERITY" count={severityCounts.MEDIUM} total={totalAlerts} color="var(--accent-saffron)" />
            <DistributionBar label="LOW / INFO" count={severityCounts.LOW} total={totalAlerts} color="var(--status-info)" />
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: 20, flex: 1 }}>
            <h2 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px 0', letterSpacing: '0.05em' }}>
              <PieChart size={16} style={{ color: 'var(--brand-terracotta)' }} /> RESPONSE STATUS WORKFLOW
            </h2>
            <DistributionBar label="NEW / UNACKNOWLEDGED" count={statusCounts.NEW} total={totalAlerts} color="var(--status-critical)" />
            <DistributionBar label="ACKNOWLEDGED / ACTIVE" count={statusCounts.ACKNOWLEDGED} total={totalAlerts} color="var(--status-info)" />
            <DistributionBar label="RESOLVED / CLOSED" count={statusCounts.RESOLVED} total={totalAlerts} color="var(--status-success)" />
          </div>
        </div>

        {/* Map Column */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', background: 'var(--structure-dark)' }}>
            <h2 style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8, margin: 0, letterSpacing: '0.05em', color: '#fff' }}>
              <MapIcon size={16} style={{ color: 'var(--brand-terracotta)' }} /> GEOGRAPHIC INTELLIGENCE
            </h2>
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: 380, background: '#090D16' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <CameraMap />
            </div>
          </div>
          <div style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <CheckCircle size={12} style={{ color: 'var(--status-success)' }}/> SPATIAL SURVEILLANCE ACTIVE
            </div>
            <div style={{ marginTop: 4 }}>Mapping of deployed operational assets and geographic coverage footprint.</div>
          </div>
        </div>
      </div>

      {/* ── OPERATIONAL REPORTING (Original functionality) ── */}
      <div id="operational-reporting" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', marginTop: 16 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
          <div>
            <h2 style={{ fontSize: '14px', margin: '0 0 4px 0', letterSpacing: '0.05em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} style={{ color: 'var(--brand-terracotta)' }}/> OPERATIONAL REPORTING QUEUE
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Asynchronous generator for compliance, audits, and external sharing.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={loadReports} disabled={reportsLoading}>
              <Activity size={14} style={{ marginRight: 6 }}/> REFRESH QUEUE
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowGenerateModal(true)}>
              <FileText size={14} style={{ marginRight: 6 }}/> REQUEST NEW REPORT
            </button>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Report Title</th>
                <th>Category</th>
                <th>Format</th>
                <th>Generated By</th>
                <th>Queued Date</th>
                <th>Status</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    {reportsLoading ? 'Loading report jobs...' : 'No reports generated yet.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{r.title}</strong></td>
                    <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.reportType}</td>
                    <td>
                      <span className="badge badge-connecting" style={{ fontFamily: 'var(--font-mono)' }}>{r.format}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.createdByName}</td>
                    <td style={{ fontSize: '11px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge badge-${r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'COMPLETED' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '10px' }}
                          onClick={() => handleDownload(r.id, r.title, r.format)}
                        >
                          DOWNLOAD
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>PROCESSING...</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Generate Report Modal (Original functionality) ── */}
      {showGenerateModal && (
        <div className="modal-backdrop">
          <div className="modal-content system-modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>REQUEST ASYNCHRONOUS REPORT GENERATION</h3>
              <button className="modal-close" onClick={() => setShowGenerateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="modal-body">
                <div className="form-group mb-2">
                  <label>Report Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Gujarat State Camera Availability & Health Audit"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label>Report Category *</label>
                  <select
                    className="form-control"
                    value={form.reportType}
                    onChange={(e) => setForm({ ...form, reportType: e.target.value })}
                  >
                    <option value="CAMERA_HEALTH">Camera Asset Status & Health Report</option>
                    <option value="DETECTION_ANPR">ANPR License Plate Detections Log</option>
                    <option value="ALERTS_SUMMARY">Surveillance Alerts Summary Report</option>
                    <option value="INVESTIGATIONS_SUMMARY">Active Investigations Dossier Report</option>
                    <option value="AUDIT_TRAIL">System Security & Access Audit Trail</option>
                  </select>
                </div>
                <div className="form-group mb-2">
                  <label>Output Export Format *</label>
                  <select
                    className="form-control"
                    value={form.format}
                    onChange={(e) => setForm({ ...form, format: e.target.value })}
                  >
                    <option value="CSV">Comma Separated Values (.CSV)</option>
                    <option value="JSON">Structured JSON (.JSON)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>CANCEL</button>
                <button type="submit" className="btn btn-primary">QUEUE REPORT GENERATION</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
