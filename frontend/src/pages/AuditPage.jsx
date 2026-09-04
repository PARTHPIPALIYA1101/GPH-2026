import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { History, ChevronLeft, ChevronRight, Filter, Loader, AlertCircle } from 'lucide-react';

/* ── action → badge colour mapping ─────────────────────────────────────── */
const ACTION_BADGE = {
  USER_LOGIN:                  'badge-success',
  USER_LOGOUT:                 'badge-info',
  USER_CREATE:                 'badge-medium',
  USER_STATUS_CHANGE:          'badge-warning',
  CAMERA_REGISTER:             'badge-info',
  CAMERA_ACCESS_REQUESTED:     'badge-medium',
  CAMERA_ACCESS_APPROVED:      'badge-success',
  CAMERA_ACCESS_REJECTED:      'badge-critical',
  CAMERA_ACCESS_REVOKED:       'badge-offline',
  CAMERA_ACCESS_APPROVED_OVERRIDE: 'badge-warning',
  WATCHLIST_CREATE:            'badge-medium',
  ALERT_ACKNOWLEDGE:           'badge-info',
  ALERT_RESOLVE:               'badge-success',
  INVESTIGATION_CREATE:        'badge-medium',
  EVIDENCE_EXPORT:             'badge-warning',
};

const ENTITY_BADGE = {
  USER:                  'badge-info',
  CAMERA:                'badge-medium',
  CAMERA_ACCESS_REQUEST: 'badge-warning',
  EVIDENCE:              'badge-high',
  WATCHLIST:             'badge-medium',
  ALERT:                 'badge-info',
  INVESTIGATION:         'badge-medium',
};

const ACTION_OPTIONS = [
  { value: '',                          label: 'All Audited Actions' },
  { value: 'USER_LOGIN',                label: 'User Login' },
  { value: 'USER_LOGOUT',               label: 'User Logout' },
  { value: 'USER_CREATE',               label: 'User Creation' },
  { value: 'CAMERA_REGISTER',           label: 'Camera Registration' },
  { value: 'CAMERA_ACCESS_REQUESTED',   label: 'Camera Access Requested' },
  { value: 'CAMERA_ACCESS_APPROVED',    label: 'Camera Access Approved' },
  { value: 'CAMERA_ACCESS_REVOKED',     label: 'Camera Access Revoked' },
  { value: 'WATCHLIST_CREATE',          label: 'Watchlist Created' },
  { value: 'ALERT_ACKNOWLEDGE',         label: 'Alert Acknowledged' },
  { value: 'ALERT_RESOLVE',             label: 'Alert Resolved' },
  { value: 'INVESTIGATION_CREATE',      label: 'Investigation Opened' },
  { value: 'EVIDENCE_EXPORT',           label: 'Evidence Exported' },
];

function fmtTs(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function safeDetail(detail) {
  if (!detail) return '—';
  if (typeof detail === 'string') return detail;
  try {
    const str = JSON.stringify(detail);
    return str.length > 120 ? str.slice(0, 120) + '…' : str;
  } catch {
    return '—';
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function AuditPage() {
  const { isStateAdmin, isDeptHead } = useAuth();

  const [logs,         setLogs]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(0);
  const [limit]                         = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [expanded,     setExpanded]     = useState(null); // expanded log id for detail

  useEffect(() => { loadAuditLogs(); }, [page, actionFilter]);

  /* ── data loader — API call preserved exactly ── */
  async function loadAuditLogs() {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        limit,
        offset: page * limit,
        ...(actionFilter && { action: actionFilter })
      });
      const res = await apiRequest(`/audit?${params.toString()}`);
      if (res.success && res.data) {
        setLogs(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load audit records.');
      console.error('Failed to load audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>
            <History size={20} style={{ display:'inline', marginRight:10, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
            Administrative Audit Trail
          </h1>
          <p>
            Append-only security and operational audit records — user actions, access decisions, and platform state changes.
          </p>
        </div>
      </div>

      <div className="panel">
        {/* Filter bar */}
        <div className="filter-bar" style={{ alignItems:'center', borderBottom:'1px solid var(--border-light)', marginBottom:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Filter size={13} style={{ color:'var(--text-muted)', flexShrink:0 }} />
            <div className="form-group" style={{ margin:0, flexDirection:'row', alignItems:'center', gap:8 }}>
              <label style={{ whiteSpace:'nowrap', margin:0 }}>Action</label>
              <select
                className="form-control"
                style={{ minWidth:220, fontSize:13 }}
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
              >
                {ACTION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>
            {!loading && `${logs.length} of ${total} records`}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <Loader size={28} className="ev-spinner empty-state-icon" />
            <div className="empty-state-title">Loading Audit Records</div>
            <div className="empty-state-desc">Retrieving immutable audit log entries…</div>
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <div className="empty-state-icon" style={{ color:'var(--status-critical)', opacity:1 }}>
              <AlertCircle size={28} />
            </div>
            <div className="empty-state-title" style={{ color:'var(--status-critical)' }}>Failed to Load Audit Trail</div>
            <div className="empty-state-desc">{loadError}</div>
            <button className="btn btn-secondary" style={{ marginTop:14 }} onClick={loadAuditLogs}>Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && logs.length === 0 && (
          <div className="empty-state" style={{ padding:'48px 20px' }}>
            <div className="empty-state-icon"><History size={32} /></div>
            <div className="empty-state-title">No Audit Records Found</div>
            <div className="empty-state-desc">
              {actionFilter ? 'No records match the selected action filter.' : 'No audit events have been recorded yet.'}
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !loadError && logs.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace:'nowrap' }}>Timestamp</th>
                  <th>Audited Action</th>
                  <th>Actor</th>
                  <th>Department</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expanded === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`audit-row ${isExpanded ? 'audit-row--expanded' : ''}`}
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        title="Click to expand detail"
                      >
                        <td style={{ whiteSpace:'nowrap', fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>
                          {fmtTs(log.createdAt)}
                        </td>
                        <td>
                          <span className={`badge ${ACTION_BADGE[log.action] || 'badge-info'}`}
                                style={{ fontSize:'9.5px', letterSpacing:'0.04em' }}>
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                            {log.actorName || 'System'}
                          </div>
                          {log.actorEmail && (
                            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                              {log.actorEmail}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                          {log.actorDepartment || '—'}
                        </td>
                        <td>
                          {log.entityType ? (
                            <span className={`badge ${ENTITY_BADGE[log.entityType] || 'badge-info'}`}
                                  style={{ fontSize:'9.5px' }}>
                              {log.entityType.replace(/_/g, ' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ maxWidth:260 }}>
                          <div className="truncate" style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>
                            {safeDetail(log.detail)}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="audit-detail-row">
                          <td colSpan={6} style={{ padding:0, border:'none' }}>
                            <div className="audit-detail-block">
                              <div className="audit-detail-label">Full Audit Detail</div>
                              <pre className="audit-detail-json mono">
                                {JSON.stringify(log.detail, null, 2)}
                              </pre>
                              {log.entityId && (
                                <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)' }}>
                                  Entity ID: <span className="mono">{log.entityId}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="adm-pagination">
            <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
              <span style={{ marginLeft:8, color:'var(--text-muted)' }}>({total} total records)</span>
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button
                className="btn btn-secondary"
                style={{ padding:'5px 10px', fontSize:12 }}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={13} /> Previous
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding:'5px 10px', fontSize:12 }}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
