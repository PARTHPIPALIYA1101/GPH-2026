import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useUI } from '../contexts/UIContext.jsx';
import { CameraMap } from '../map/CameraMap.jsx';
import {
  Activity, Radio, Shield, CheckCircle, Map as MapIcon,
  BarChart2, PieChart, FileText, Download, Target, Video,
  FolderKanban, AlertTriangle, X
} from 'lucide-react';

// ─── KPI Block ─────────────────────────────────────────────────────────────────
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

// ─── Distribution Bar ───────────────────────────────────────────────────────────
function DistributionBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="dist-bar-row">
      <div className="dist-bar-header">
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div className="dist-bar-track">
        <div className="dist-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Report Status Badge ────────────────────────────────────────────────────────
function ReportStatusBadge({ status }) {
  const cls = {
    PENDING:    'badge badge-pending',
    PROCESSING: 'badge badge-processing',
    COMPLETED:  'badge badge-completed',
    FAILED:     'badge badge-failed',
  }[status] || 'badge badge-connecting';
  return <span className={cls}>{status}</span>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { showToast } = useUI();
  // Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    reportType: 'CAMERA_HEALTH',
    format: 'CSV',
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
        apiRequest('/search?limit=1').catch(() => null),
      ]);

      if (sumRes?.success)    setSummary(sumRes.data);
      if (alertsRes?.success) setAlerts(alertsRes.data.items || []);
      if (invRes?.success)    setInvestigationsTotal(invRes.data.total || 0);
      if (anprRes?.success)   setAnprTotal(anprRes.data.total || 0);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  // ─── Reports Load & Handlers ───
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
      const res = await apiRequest('/reports', { method: 'POST', body: form });
      if (res.success) {
        showToast('Report generation job queued asynchronously.', 'info');
        setShowGenerateModal(false);
        setForm({ title: '', reportType: 'CAMERA_HEALTH', format: 'CSV' });
        setTimeout(loadReports, 1000);
      }
    } catch (err) {
      showToast(`Report request failed: ${err.message}`, 'danger');
    }
  }

  function handleDownload(reportId, title, format) {
    const token = localStorage.getItem('gov_auth_token');
    fetch(`/api/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
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
      .catch((err) => showToast(err.message, 'danger'));
  }

  // ─── Data Aggregation ───
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const statusCounts   = { NEW: 0, ACKNOWLEDGED: 0, RESOLVED: 0 };

  alerts.forEach((a) => {
    if (severityCounts[a.severity] !== undefined) severityCounts[a.severity]++;
    if (statusCounts[a.status]    !== undefined) statusCounts[a.status]++;
  });

  const totalAlerts  = alerts.length || 1; // used for percentages (avoid div/0)
  const offlineCount = summary ? (summary.totalCameras - summary.onlineCount) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <Activity size={13} style={{ color: 'var(--accent-saffron)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--accent-saffron)', letterSpacing: '0.09em' }}>
              STATEWIDE THREAT &amp; INCIDENT ANALYTICS
            </span>
          </div>
          <h1>CRIME INTELLIGENCE &amp; ANALYTICS CENTER</h1>
          <p>Statewide Threat Analysis · Incident Distributions · Geographic Intelligence · Operational Reporting</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => document.getElementById('operational-reporting')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <FileText size={14} /> GENERATE REPORT
        </button>
      </div>

      {/* ── KEY INTELLIGENCE OVERVIEW (KPIs) ── */}
      <div>
        <div className="reports-section-label">KEY INTELLIGENCE OVERVIEW</div>
        <div className="reports-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <KpiBlock
            icon={<Radio size={22} />}
            label="Total Alerts"
            value={analyticsLoading ? '...' : alerts.length.toLocaleString()}
            accentColor="var(--status-warning)"
          />
          <KpiBlock
            icon={<AlertTriangle size={22} />}
            label="Active Critical"
            value={analyticsLoading ? '...' : severityCounts.CRITICAL}
            accentColor="var(--status-critical)"
          />
          <KpiBlock
            icon={<FolderKanban size={22} />}
            label="Active Cases"
            value={analyticsLoading ? '...' : investigationsTotal.toLocaleString()}
            accentColor="var(--accent-saffron)"
          />
          <KpiBlock
            icon={<Video size={22} />}
            label="Cameras Online"
            value={analyticsLoading ? '...' : summary?.onlineCount}
            sub={offlineCount != null ? `${offlineCount} offline` : undefined}
            accentColor="var(--status-success)"
          />
          <KpiBlock
            icon={<Target size={22} />}
            label="ANPR Captures"
            value={analyticsLoading ? '...' : anprTotal.toLocaleString()}
            accentColor="var(--status-info)"
          />
        </div>
      </div>

      {/* ── ALERT DISTRIBUTION & GEOGRAPHIC INTELLIGENCE ── */}
      <div className="reports-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Distribution column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Severity Distribution */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.01)' }}>
              <BarChart2 size={14} style={{ color: 'var(--brand-terracotta)', flexShrink: 0 }} />
              <h2 style={{ fontSize: '12px', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Incident Severity Distribution
              </h2>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {analyticsLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
              ) : (
                <>
                  <DistributionBar label="Critical Threats" count={severityCounts.CRITICAL} total={totalAlerts} color="var(--status-critical)" />
                  <DistributionBar label="High Severity"    count={severityCounts.HIGH}     total={totalAlerts} color="var(--status-warning)" />
                  <DistributionBar label="Medium Severity"  count={severityCounts.MEDIUM}   total={totalAlerts} color="var(--accent-saffron)" />
                  <DistributionBar label="Low / Info"       count={severityCounts.LOW}      total={totalAlerts} color="var(--status-info)" />
                </>
              )}
            </div>
          </div>

          {/* Response Status Workflow */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', flex: 1 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.01)' }}>
              <PieChart size={14} style={{ color: 'var(--brand-terracotta)', flexShrink: 0 }} />
              <h2 style={{ fontSize: '12px', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Response Status Workflow
              </h2>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {analyticsLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
              ) : (
                <>
                  <DistributionBar label="New / Unacknowledged"  count={statusCounts.NEW}          total={totalAlerts} color="var(--status-critical)" />
                  <DistributionBar label="Acknowledged / Active" count={statusCounts.ACKNOWLEDGED}  total={totalAlerts} color="var(--status-info)" />
                  <DistributionBar label="Resolved / Closed"     count={statusCounts.RESOLVED}      total={totalAlerts} color="var(--status-success)" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Geographic Intelligence */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', background: 'var(--structure-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapIcon size={14} style={{ color: 'var(--brand-terracotta)', flexShrink: 0 }} />
            <h2 style={{ fontSize: '12px', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff' }}>
              Geographic Intelligence
            </h2>
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: 340, background: '#090D16' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <CameraMap />
            </div>
          </div>
          <div style={{ padding: '10px 18px', fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <CheckCircle size={11} style={{ color: 'var(--status-success)' }} /> SPATIAL SURVEILLANCE ACTIVE
            </div>
            <div style={{ marginTop: 3 }}>Mapping of deployed operational assets and geographic coverage footprint.</div>
          </div>
        </div>
      </div>

      {/* ── OPERATIONAL REPORTING QUEUE ── */}
      <div id="operational-reporting" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>

        {/* Queue header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
          <div>
            <h2 style={{ fontSize: '13px', margin: '0 0 3px 0', letterSpacing: '0.06em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
              <Download size={14} style={{ color: 'var(--brand-terracotta)' }} /> Operational Reporting Queue
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              Asynchronous generator for compliance, audits, and external sharing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={loadReports} disabled={reportsLoading}>
              <Activity size={13} /> Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowGenerateModal(true)}>
              <FileText size={13} /> Request Report
            </button>
          </div>
        </div>

        {/* Reports table */}
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
                <th style={{ textAlign: 'right' }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    {reportsLoading ? 'Loading report jobs…' : 'No reports generated yet.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{r.title}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                        {r.reportType}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-connecting">{r.format}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.createdByName}</td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'COMPLETED' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownload(r.id, r.title, r.format)}
                        >
                          <Download size={12} /> DOWNLOAD
                        </button>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                          PROCESSING…
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── GENERATE REPORT MODAL ── */}
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
                    placeholder="e.g. Gujarat State Camera Availability &amp; Health Audit"
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
                    <option value="CAMERA_HEALTH">Camera Asset Status &amp; Health Report</option>
                    <option value="DETECTION_ANPR">ANPR License Plate Detections Log</option>
                    <option value="ALERTS_SUMMARY">Surveillance Alerts Summary Report</option>
                    <option value="INVESTIGATIONS_SUMMARY">Active Investigations Dossier Report</option>
                    <option value="AUDIT_TRAIL">System Security &amp; Access Audit Trail</option>
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
