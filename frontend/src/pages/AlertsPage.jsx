import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import {
  Radio, AlertTriangle, CheckCircle, Clock, Search,
  MapPin, Video, Shield, Plus, Settings, Filter,
  ChevronLeft, ChevronRight, X, ArrowRight, Activity,
  FileText, Eye, Bell
} from 'lucide-react';

// ─── Severity helpers ──────────────────────────────────────────────────────────
const SEV_COLOR = {
  CRITICAL: 'var(--status-critical)',
  HIGH: 'var(--status-warning)',
  MEDIUM: 'var(--accent-saffron)',
  LOW: 'var(--status-info)',
};
const SEV_BG = {
  CRITICAL: 'var(--status-critical-bg)',
  HIGH: 'var(--status-warning-bg)',
  MEDIUM: 'var(--accent-saffron-light)',
  LOW: 'var(--status-info-bg)',
};

function SeverityPill({ severity }) {
  const c = SEV_COLOR[severity] || 'var(--text-secondary)';
  const bg = SEV_BG[severity] || 'rgba(0,0,0,0.05)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
      background: bg, color: c,
      border: `1px solid ${c}40`, padding: '2px 8px', borderRadius: 2,
      letterSpacing: '0.06em', whiteSpace: 'nowrap'
    }}>
      {severity}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    NEW: { color: 'var(--status-critical)', bg: 'var(--status-critical-bg)' },
    ACKNOWLEDGED: { color: 'var(--status-info)', bg: 'var(--status-info-bg)' },
    RESOLVED: { color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  };
  const { color, bg } = map[status] || { color: 'var(--text-secondary)', bg: 'rgba(0,0,0,0.05)' };
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
      background: bg, color,
      border: `1px solid ${color}40`, padding: '2px 8px', borderRadius: 2,
      letterSpacing: '0.06em'
    }}>
      {status}
    </span>
  );
}

// ─── Response Workflow Steps ───────────────────────────────────────────────────
const WORKFLOW_STEPS = ['DETECTED', 'REPORTED', 'ACKNOWLEDGED', 'RESOLVED'];

function ResponseWorkflow({ status }) {
  const currentIdx = status === 'NEW' ? 1 : status === 'ACKNOWLEDGED' ? 2 : status === 'RESOLVED' ? 3 : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? (active ? 'var(--brand-terracotta)' : 'var(--status-success)') : 'var(--border-medium)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: active ? '2px solid var(--brand-terracotta)' : 'none',
                flexShrink: 0
              }}>
                {done && !active
                  ? <CheckCircle size={14} color="#fff" />
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                }
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: done ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {step}
              </span>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < currentIdx ? 'var(--status-success)' : 'var(--border-medium)', minWidth: 20, marginBottom: 14 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Elapsed time helper ───────────────────────────────────────────────────────
function elapsed(isoDate) {
  if (!isoDate) return '—';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

// ─── Incident Queue Row ────────────────────────────────────────────────────────
function IncidentRow({ alert, selected, onClick }) {
  const sev = alert.severity;
  const stripe = SEV_COLOR[sev] || 'var(--text-muted)';
  const isNew = alert.status === 'NEW';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px 1fr',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-light)',
        background: selected
          ? 'rgba(229,138,36,0.06)'
          : isNew ? 'rgba(201,54,43,0.02)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent-saffron)' : '3px solid transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = isNew ? 'rgba(201,54,43,0.02)' : 'transparent'; }}
    >
      {/* Left severity stripe */}
      <div style={{ background: stripe, width: 4 }} />

      <div style={{ padding: '12px 14px' }}>
        {/* Top row: severity + time */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SeverityPill severity={sev} />
            {isNew && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--status-critical)', letterSpacing: '0.06em', animation: 'pulse 1.5s infinite' }}>
                ● NEW
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            {elapsed(alert.createdAt)}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alert.title}
        </div>

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--text-secondary)' }}>
          <MapPin size={10} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[alert.cameraName, alert.cityName].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Incident Detail Panel ─────────────────────────────────────────────────────
function IncidentDetail({ alert, resolutionNotes, setResolutionNotes, onAcknowledge, onResolve }) {
  if (!alert) {
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <Radio size={40} className="empty-state-icon" />
        <div className="empty-state-title">Select an incident from the queue to begin triage.</div>
      </div>
    );
  }

  const sev = alert.severity;
  const stripeColor = SEV_COLOR[sev] || 'var(--text-muted)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Detail header ── */}
      <div style={{
        background: 'var(--structure-dark)',
        color: '#fff',
        padding: '20px 24px',
        borderBottom: `3px solid ${stripeColor}`,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SeverityPill severity={alert.severity} />
            <StatusPill status={alert.status} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7A87', letterSpacing: '0.06em' }}>
            ID: {alert.id?.split('-')[0]?.toUpperCase()}
          </div>
        </div>

        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>
          {alert.title}
        </h2>
        <div style={{ fontSize: '12px', color: '#9BA3AB' }}>
          <Clock size={11} style={{ display: 'inline', marginRight: 5 }} />
          {new Date(alert.createdAt).toLocaleString('en-IN')}
          <span style={{ margin: '0 8px' }}>·</span>
          {elapsed(alert.createdAt)}
        </div>

        {/* Response workflow */}
        <div style={{ marginTop: 16 }}>
          <ResponseWorkflow status={alert.status} />
        </div>
      </div>

      {/* ── Scrollable detail body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Trigger / Description ── */}
        <section>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
            Incident Intelligence
          </div>
          <div style={{
            background: sev === 'CRITICAL' ? 'var(--status-critical-bg)' : 'var(--bg-main)',
            border: `1px solid ${sev === 'CRITICAL' ? 'rgba(201,54,43,0.25)' : 'var(--border-light)'}`,
            padding: '14px 16px', borderRadius: 2
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {alert.description || 'No description available.'}
            </div>
          </div>
        </section>

        {/* ── Location & Source ── */}
        <section>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
            Location & Source
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InfoField icon={<MapPin size={13} />} label="City / Zone" value={alert.cityName || '—'} />
            <InfoField icon={<MapPin size={13} />} label="Camera Location" value={alert.cameraLocation || '—'} />
            <InfoField icon={<Video size={13} />} label="Camera Unit" value={alert.cameraName || '—'} />
            <InfoField icon={<Shield size={13} />} label="Department" value={alert.departmentName || alert.departmentCode || '—'} />
          </div>
        </section>

        {/* ── ANPR / Vehicle Intelligence ── */}
        {(alert.plateNumber || alert.vehicleType || alert.vehicleColor || alert.description?.includes('PLATE')) && (
          <section>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
              ANPR / Vehicle Intelligence
            </div>
            <div style={{
              background: 'var(--structure-dark)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 16, borderRadius: 2
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--accent-saffron)', letterSpacing: '0.06em' }}>
                {alert.plateNumber || alert.description?.match(/PLATE:\s*([A-Z0-9]+)/)?.[1] || '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#9BA3AB' }}>
                {[alert.vehicleColor, alert.vehicleType].filter(Boolean).join(' ') || 'Vehicle details unavailable'}
              </div>
            </div>
          </section>
        )}

        {/* ── Resolution section (if already resolved) ── */}
        {alert.status === 'RESOLVED' && (
          <section>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
              Resolution Record
            </div>
            <div style={{
              background: 'var(--status-success-bg)',
              border: '1px solid rgba(52,120,91,0.3)',
              padding: '14px 16px', borderRadius: 2
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-success)', marginBottom: 6, letterSpacing: '0.05em' }}>
                RESOLVED BY {alert.resolvedByName?.toUpperCase() || 'OFFICER'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {alert.resolutionNotes || 'No resolution notes provided.'}
              </div>
              {alert.resolvedAt && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--status-success)', marginTop: 8 }}>
                  {new Date(alert.resolvedAt).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Triage actions ── */}
        <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.07em', marginBottom: 12, textTransform: 'uppercase' }}>
            Response Actions
          </div>

          {alert.status === 'NEW' && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 12, padding: '10px' }}
              onClick={() => onAcknowledge(alert.id)}
            >
              <Activity size={15} /> ACKNOWLEDGE — TAKE COMMAND
            </button>
          )}

          {alert.status !== 'RESOLVED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Resolution Notes *
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter dispatch notes, intercept confirmation, or closure reason…"
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                style={{ fontFamily: 'var(--font-body)', fontSize: '13px', resize: 'vertical' }}
              />
              <button
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                onClick={() => onResolve(alert.id)}
              >
                <CheckCircle size={15} /> RESOLVE &amp; CLOSE INCIDENT
              </button>
            </div>
          )}

          {alert.status === 'RESOLVED' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-success)', fontSize: '13px', fontWeight: 600 }}>
              <CheckCircle size={16} />
              Incident closed. No further actions required.
            </div>
          )}
        </section>
      </div>
    </div>
  );
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

// ─── Rule Config Modal ─────────────────────────────────────────────────────────
function RuleModal({ ruleForm, setRuleForm, onSubmit, onClose, isStateAdmin }) {
  return (
    <div className="modal-backdrop">
      <div className="system-modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 style={{ color: '#fff', margin: 0, fontSize: '14px', letterSpacing: '0.04em' }}>CONFIGURE ALERT TRIGGER RULE</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Rule Name *</label>
              <input type="text" className="form-control" required
                placeholder="e.g. Stolen Vehicle ANPR Match"
                value={ruleForm.name}
                onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} />
            </div>
            {isStateAdmin && (
              <div className="form-group">
                <label>Scope</label>
                <select className="form-control" value={ruleForm.scope}
                  onChange={e => setRuleForm({ ...ruleForm, scope: e.target.value })}>
                  <option value="DEPARTMENT">DEPARTMENT LEVEL</option>
                  <option value="GLOBAL">STATEWIDE GLOBAL</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Severity</label>
              <select className="form-control" value={ruleForm.severity}
                onChange={e => setRuleForm({ ...ruleForm, severity: e.target.value })}>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div className="form-group">
              <label>Condition JSON *</label>
              <textarea className="form-control mono" rows={4} required
                value={ruleForm.conditions}
                onChange={e => setRuleForm({ ...ruleForm, conditions: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>CANCEL</button>
            <button type="submit" className="btn btn-primary">SAVE RULE</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AlertsPage() {
  const { isStateAdmin, isDeptHead } = useAuth();
  const { showToast } = useUI();

  const [activeTab, setActiveTab] = useState('triage');
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(30);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '', scope: 'DEPARTMENT', severity: 'HIGH',
    conditions: '{"eventType":"ANPR_MATCH","minConfidence":0.85}'
  });

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit, offset: page * limit,
        ...(statusFilter && { status: statusFilter }),
        ...(severityFilter && { severity: severityFilter })
      });
      const res = await apiRequest(`/alerts?${params}`);
      if (res.success && res.data) {
        setAlerts(res.data.items || []);
        setTotal(res.data.total || 0);
        // Auto-select first if nothing selected
        if (!selectedAlert && res.data.items?.length > 0) {
          setSelectedAlert(res.data.items[0]);
        }
      }
    } catch (err) {
      showToast(`Failed to load alerts: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, severityFilter]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/alerts/rules');
      if (res.success && res.data) setRules(res.data || []);
    } catch (err) {
      showToast(`Failed to load rules: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'triage') loadAlerts();
    else loadRules();
  }, [activeTab, page, statusFilter, severityFilter]);

  function selectAlert(a) {
    setSelectedAlert(a);
    setResolutionNotes('');
  }

  async function handleAcknowledge(id) {
    try {
      const res = await apiRequest(`/alerts/${id}/acknowledge`, { method: 'POST' });
      if (res.success) {
        showToast('Alert ACKNOWLEDGED — you have taken command.', 'success');
        loadAlerts();
        setSelectedAlert(prev => prev?.id === id ? { ...prev, status: 'ACKNOWLEDGED' } : prev);
      }
    } catch (err) {
      showToast(`Acknowledgement failed: ${err.message}`, 'danger');
    }
  }

  async function handleResolve(id) {
    if (!resolutionNotes.trim()) {
      showToast('Resolution notes are mandatory before closing the incident.', 'warning');
      return;
    }
    try {
      const res = await apiRequest(`/alerts/${id}/resolve`, {
        method: 'POST',
        body: { resolutionNotes }
      });
      if (res.success) {
        showToast('Incident RESOLVED & closed.', 'success');
        setResolutionNotes('');
        loadAlerts();
        setSelectedAlert(prev => prev?.id === id ? { ...prev, status: 'RESOLVED', resolutionNotes } : prev);
      }
    } catch (err) {
      showToast(`Resolution failed: ${err.message}`, 'danger');
    }
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    try {
      let parsedConditions = {};
      try { parsedConditions = JSON.parse(ruleForm.conditions); }
      catch { showToast('Conditions must be valid JSON.', 'warning'); return; }
      const res = await apiRequest('/alerts/rules', {
        method: 'POST',
        body: { name: ruleForm.name, scope: ruleForm.scope, severity: ruleForm.severity, conditions: parsedConditions }
      });
      if (res.success) {
        showToast('Alert rule saved.', 'success');
        setShowRuleModal(false);
        setRuleForm({ name: '', scope: 'DEPARTMENT', severity: 'HIGH', conditions: '{"eventType":"ANPR_MATCH"}' });
        loadRules();
      }
    } catch (err) {
      showToast(`Failed to create rule: ${err.message}`, 'danger');
    }
  }

  const totalPages = Math.ceil(total / limit);
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const newCount = alerts.filter(a => a.status === 'NEW').length;

  const filteredAlerts = searchQuery
    ? alerts.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.cityName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.cameraName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : alerts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Radio size={14} style={{ color: 'var(--status-critical)', animation: newCount > 0 ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--status-critical)', letterSpacing: '0.08em' }}>
              {newCount > 0 ? `${newCount} UNACKNOWLEDGED INCIDENT${newCount > 1 ? 'S' : ''}` : 'ALL CLEAR'}
            </span>
          </div>
          <h1>EMERGENCY RESPONSE CENTER</h1>
          <p>
            Real-time incident triage · ANPR threat response · Alert rule management
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'triage' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('triage')}
          >
            <Bell size={14} /> Incident Queue
          </button>
          <button
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('rules')}
          >
            <Settings size={14} /> Alert Rules
          </button>
          {activeTab === 'rules' && (isStateAdmin || isDeptHead) && (
            <button className="btn btn-primary" onClick={() => setShowRuleModal(true)}>
              <Plus size={14} /> New Rule
            </button>
          )}
        </div>
      </div>

      {activeTab === 'triage' ? (
        <>
          {/* ── KPI strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'CRITICAL', count: criticalCount, color: 'var(--status-critical)' },
              { label: 'HIGH', count: highCount, color: 'var(--status-warning)' },
              { label: 'MEDIUM', count: alerts.filter(a => a.severity === 'MEDIUM').length, color: 'var(--accent-saffron)' },
              { label: 'TOTAL QUEUE', count: total, color: 'var(--status-info)' },
            ].map(({ label, count, color }) => (
              <div key={label} className="kpi-block" style={{ borderLeft: `3px solid ${color}`, justifyContent: 'space-between' }}>
                <span className="kpi-block-label">{label}</span>
                <span className="kpi-block-value">{count}</span>
              </div>
            ))}
          </div>

          {/* ── Main split: Queue | Detail ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 0, flex: 1, border: '1px solid var(--border-light)', background: 'var(--bg-surface)', minHeight: 0, overflow: 'hidden' }}>

            {/* ── LEFT: Incident Queue ── */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', overflow: 'hidden' }}>
              {/* Filter bar */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.01)', flexShrink: 0 }}>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: '13px', minWidth: 0, width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-control" value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                    style={{ fontSize: '11px', flex: 1, minWidth: 0 }}>
                    <option value="">ALL STATUSES</option>
                    <option value="NEW">NEW</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                  <select className="form-control" value={severityFilter}
                    onChange={e => { setSeverityFilter(e.target.value); setPage(0); }}
                    style={{ fontSize: '11px', flex: 1, minWidth: 0 }}>
                    <option value="">ALL SEVERITIES</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              {/* Incident list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && filteredAlerts.length === 0 ? (
                  <div className="empty-state">Loading incident queue…</div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="empty-state">
                    <CheckCircle size={28} className="empty-state-icon" style={{ color: 'var(--status-success)' }} />
                    <div className="empty-state-title">No incidents match your filters.</div>
                  </div>
                ) : (
                  filteredAlerts.map(a => (
                    <IncidentRow
                      key={a.id}
                      alert={a}
                      selected={selectedAlert?.id === a.id}
                      onClick={() => selectAlert(a)}
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
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      style={{ padding: '4px 8px', fontSize: '11px' }}>
                      <ChevronLeft size={13} />
                    </button>
                    <button className="btn btn-secondary" disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Incident Detail ── */}
            <IncidentDetail
              alert={selectedAlert}
              resolutionNotes={resolutionNotes}
              setResolutionNotes={setResolutionNotes}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
            />
          </div>
        </>
      ) : (
        /* ── RULES TAB ── */
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.01)'
          }}>
            <h2 style={{ fontSize: '14px', margin: 0, letterSpacing: '0.03em' }}>CONFIGURED ALERT TRIGGER RULES</h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              {rules.length} rule{rules.length !== 1 ? 's' : ''} active
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Scope</th>
                  <th>Department</th>
                  <th>Severity</th>
                  <th>Trigger Conditions</th>
                  <th>Configured By</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No alert rules configured.
                    </td>
                  </tr>
                ) : (
                  rules.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, background: 'var(--status-info-bg)', color: 'var(--status-info)', border: '1px solid rgba(57,120,140,0.2)', padding: '2px 7px', borderRadius: 2 }}>{r.scope}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.departmentName || 'STATEWIDE'}</td>
                      <td><SeverityPill severity={r.severity} /></td>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(0,0,0,0.05)', padding: '3px 6px', borderRadius: 2, color: 'var(--text-secondary)' }}>
                          {JSON.stringify(r.conditions)}
                        </code>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.createdByName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Rule creation modal ── */}
      {showRuleModal && (
        <RuleModal
          ruleForm={ruleForm}
          setRuleForm={setRuleForm}
          onSubmit={handleCreateRule}
          onClose={() => setShowRuleModal(false)}
          isStateAdmin={isStateAdmin}
        />
      )}
    </div>
  );
}
