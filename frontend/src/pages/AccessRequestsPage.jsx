import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { Users, ArrowDownCircle, ArrowUpCircle, Clock, CalendarX, CheckCircle, XCircle, Loader, X, Camera } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const STATUS_BADGE = {
  PENDING:  'badge-high',
  APPROVED: 'badge-success',
  REJECTED: 'badge-critical',
  REVOKED:  'badge-offline',
  EXPIRED:  'badge-offline',
};

const STATUS_ICON = {
  PENDING:  <Clock size={11} />,
  APPROVED: <CheckCircle size={11} />,
  REJECTED: <XCircle size={11} />,
  REVOKED:  <XCircle size={11} />,
  EXPIRED:  <CalendarX size={11} />,
};

const DURATION_BADGE = {
  TEMPORARY: 'badge-medium',
  PERMANENT: 'badge-info',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFull(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function AccessRequestsPage() {
  const { isStateAdmin, isDeptHead } = useAuth();
  const { showToast, showModal } = useUI();

  const [direction,                    setDirection]                    = useState('incoming');
  const [requests,                     setRequests]                     = useState([]);
  const [total,                        setTotal]                        = useState(0);
  const [loading,                      setLoading]                      = useState(true);
  const [loadError,                    setLoadError]                    = useState('');
  const [selectedRequestForDecision,   setSelectedRequestForDecision]   = useState(null);
  const [decisionForm,                 setDecisionForm]                 = useState({ status: 'APPROVED', reason: '' });

  useEffect(() => { loadRequests(); }, [direction]);

  /* ── data loaders — API calls preserved exactly ── */
  async function loadRequests() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiRequest(`/access-requests?direction=${direction}`);
      if (res.success && res.data) {
        setRequests(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load access requests.');
      console.error('Failed to load access requests:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecisionSubmit(e) {
    e.preventDefault();
    if (!selectedRequestForDecision) return;
    try {
      const res = await apiRequest(`/access-requests/${selectedRequestForDecision.id}/decision`, {
        method: 'POST', body: decisionForm
      });
      if (res.success) {
        showToast(`Access request ${decisionForm.status.toLowerCase()} successfully.`, 'success');
        setSelectedRequestForDecision(null);
        setDecisionForm({ status: 'APPROVED', reason: '' });
        loadRequests();
      }
    } catch (err) {
      showToast(`Decision failed: ${err.message}`, 'danger');
    }
  }

  async function handleRevoke(id) {
    showModal({
      title: 'Revoke Camera Access Grant',
      message: 'Are you sure you want to revoke this camera access grant?',
      confirmText: 'Revoke Access',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/access-requests/${id}/revoke`, { method: 'POST' });
          if (res.success) {
            showToast('Camera access grant revoked.', 'success');
            loadRequests();
          }
        } catch (err) {
          showToast(`Revocation failed: ${err.message}`, 'danger');
        }
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>
            <Users size={20} style={{ display:'inline', marginRight:10, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
            Camera Access Sharing
          </h1>
          <p>Manage inter-departmental camera access requests, time-bound approvals, and revocations.</p>
        </div>

        {/* Direction toggle */}
        <div className="ar-direction-toggle">
          <button
            className={`ar-toggle-btn ${direction === 'incoming' ? 'ar-toggle-btn--active' : ''}`}
            onClick={() => setDirection('incoming')}
          >
            <ArrowDownCircle size={14} />
            Incoming Requests
          </button>
          <button
            className={`ar-toggle-btn ${direction === 'outgoing' ? 'ar-toggle-btn--active' : ''}`}
            onClick={() => setDirection('outgoing')}
          >
            <ArrowUpCircle size={14} />
            My Department
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-header">
          <h2>
            {direction === 'incoming' ? 'Incoming Access Requests' : 'Outgoing Access Requests'}
          </h2>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {!loading && (
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>
                {total} {total === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <Loader size={28} className="ev-spinner empty-state-icon" />
            <div className="empty-state-title">Loading Requests</div>
            <div className="empty-state-desc">Retrieving access sharing records…</div>
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="empty-state" style={{ padding:'40px 20px' }}>
            <div className="empty-state-icon" style={{ color:'var(--status-critical)', opacity:1 }}>
              <XCircle size={28} />
            </div>
            <div className="empty-state-title" style={{ color:'var(--status-critical)' }}>Failed to Load</div>
            <div className="empty-state-desc">{loadError}</div>
            <button className="btn btn-secondary" style={{ marginTop:14 }} onClick={loadRequests}>Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && requests.length === 0 && (
          <div className="empty-state" style={{ padding:'48px 20px' }}>
            <div className="empty-state-icon">
              {direction === 'incoming' ? <ArrowDownCircle size={32} /> : <ArrowUpCircle size={32} />}
            </div>
            <div className="empty-state-title">
              {direction === 'incoming' ? 'No Incoming Requests' : 'No Outgoing Requests'}
            </div>
            <div className="empty-state-desc">
              No access sharing requests found in this category.
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !loadError && requests.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table ar-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Requesting Department</th>
                  <th>Requester</th>
                  <th>Cameras</th>
                  <th>Duration</th>
                  <th>Operational Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>

                    <td style={{ whiteSpace:'nowrap', fontSize:12, color:'var(--text-secondary)' }}>
                      {fmt(req.requestedAt)}
                    </td>

                    <td>
                      <div className="ar-dept-cell">
                        <span className="ar-dept-name">{req.requestingDepartment}</span>
                        {req.requestingDepartmentCode && (
                          <span className="badge badge-info" style={{ fontSize:9 }}>
                            {req.requestingDepartmentCode}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ fontSize:13 }}>{req.requesterName}</td>

                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <Camera size={12} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700 }}>
                          {req.cameraCount}
                        </span>
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {Number(req.cameraCount) === 1 ? 'camera' : 'cameras'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${DURATION_BADGE[req.duration] || 'badge-info'}`}>
                        {req.duration}
                      </span>
                      {req.expiresAt && (
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, whiteSpace:'nowrap' }}>
                          Exp: {fmt(req.expiresAt)}
                        </div>
                      )}
                    </td>

                    <td style={{ maxWidth:240 }}>
                      <div className="truncate" style={{ fontSize:13 }} title={req.reason}>
                        {req.reason}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${STATUS_BADGE[req.status] || 'badge-info'}`}
                            style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                        {STATUS_ICON[req.status]}
                        {req.status}
                      </span>
                      {req.decidedAt && (
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                          {fmt(req.decidedAt)}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                      {req.status === 'PENDING' && (isDeptHead || isStateAdmin) && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize:12, padding:'5px 10px' }}
                          onClick={() => {
                            setSelectedRequestForDecision(req);
                            setDecisionForm({ status: 'APPROVED', reason: '' });
                          }}
                        >
                          Decide
                        </button>
                      )}
                      {req.status === 'APPROVED' && (isDeptHead || isStateAdmin) && (
                        <button
                          className="btn btn-danger"
                          style={{ fontSize:12, padding:'5px 10px' }}
                          onClick={() => handleRevoke(req.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Decision Modal ══ */}
      {selectedRequestForDecision && (
        <div className="modal-backdrop">
          <div className="system-modal" style={{ maxWidth:520 }}>
            <div className="modal-header">
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'0.05em' }}>
                DECIDE CAMERA ACCESS REQUEST
              </h3>
              <button className="modal-close" onClick={() => setSelectedRequestForDecision(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDecisionSubmit}>
              <div className="modal-body">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  {/* Request summary block */}
                  <div className="ar-request-summary">
                    <div className="ar-summary-row">
                      <span className="ar-summary-label">Requesting Dept</span>
                      <span className="ar-summary-value">
                        <strong>{selectedRequestForDecision.requestingDepartment}</strong>
                        {selectedRequestForDecision.requestingDepartmentCode && (
                          <span className="badge badge-info" style={{ marginLeft:8, fontSize:9 }}>
                            {selectedRequestForDecision.requestingDepartmentCode}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="ar-summary-row">
                      <span className="ar-summary-label">Requester</span>
                      <span className="ar-summary-value">{selectedRequestForDecision.requesterName}</span>
                    </div>
                    <div className="ar-summary-row">
                      <span className="ar-summary-label">Duration</span>
                      <span className="ar-summary-value">
                        <span className={`badge ${DURATION_BADGE[selectedRequestForDecision.duration] || 'badge-info'}`}>
                          {selectedRequestForDecision.duration}
                        </span>
                        {selectedRequestForDecision.expiresAt && (
                          <span style={{ marginLeft:8, fontSize:12, color:'var(--text-secondary)' }}>
                            until {fmtFull(selectedRequestForDecision.expiresAt)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="ar-summary-row ar-summary-reason">
                      <span className="ar-summary-label">Operational Reason</span>
                      <span className="ar-summary-value" style={{ fontStyle:'italic', color:'var(--text-secondary)' }}>
                        "{selectedRequestForDecision.reason}"
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ar-decision">Official Decision *</label>
                    <select
                      id="ar-decision"
                      className="form-control"
                      value={decisionForm.status}
                      onChange={e => setDecisionForm({ ...decisionForm, status: e.target.value })}
                    >
                      <option value="APPROVED">Approve Request</option>
                      <option value="REJECTED">Reject Request</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ar-reason">Decision Reason / Authorization Remarks *</label>
                    <textarea
                      id="ar-reason"
                      className="form-control"
                      rows="3"
                      required
                      placeholder="Enter the official reason for approval or rejection…"
                      value={decisionForm.reason}
                      onChange={e => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                    />
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setSelectedRequestForDecision(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${decisionForm.status === 'APPROVED' ? 'btn-primary' : 'btn-danger'}`}
                >
                  {decisionForm.status === 'APPROVED' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {decisionForm.status === 'APPROVED' ? 'Approve Access' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
