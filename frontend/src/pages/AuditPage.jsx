import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function AuditPage() {
  const { isStateAdmin, isDeptHead } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [page, actionFilter]);

  async function loadAuditLogs() {
    setLoading(true);
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
      console.error('Failed to load audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="breadcrumbs">Home / Security & Operations Audit Trail</div>
      <div className="page-header">
        <div>
          <h1>Immutable Administrative Audit Trail</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Append-only security and operational audit records tracking user actions, access decisions, and camera state changes.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <div className="filter-group">
            <label>Action Filter:</label>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
              <option value="">All Audited Actions</option>
              <option value="USER_LOGIN">User Login</option>
              <option value="USER_LOGOUT">User Logout</option>
              <option value="USER_CREATE">User Creation</option>
              <option value="CAMERA_REGISTER">Camera Registration</option>
              <option value="CAMERA_ACCESS_REQUESTED">Camera Access Requested</option>
              <option value="CAMERA_ACCESS_APPROVED">Camera Access Approved</option>
              <option value="CAMERA_ACCESS_REVOKED">Camera Access Revoked</option>
              <option value="WATCHLIST_CREATE">Watchlist Created</option>
              <option value="ALERT_ACKNOWLEDGE">Alert Acknowledged</option>
              <option value="ALERT_RESOLVE">Alert Resolved</option>
              <option value="INVESTIGATION_CREATE">Investigation Opened</option>
              <option value="EVIDENCE_EXPORT">Evidence Exported</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-light)' }}>
            Showing {logs.length} of {total} audit records
          </div>
        </div>

        <div className="data-table-wrapper">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Audited Action</th>
                <th>Actor User</th>
                <th>Department</th>
                <th>Target Entity</th>
                <th>Audit Details & Context</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                    {loading ? 'Loading audit records...' : 'No audit records found.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-connecting" style={{ fontSize: '10px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <strong>{log.actorName || 'System'}</strong>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-light)' }}>{log.actorEmail}</div>
                    </td>
                    <td>{log.actorDepartment || '—'}</td>
                    <td>
                      <span className="badge badge-active">{log.entityType}</span>
                    </td>
                    <td>
                      <code className="mono" style={{ fontSize: '11px', color: '#334155' }}>
                        {JSON.stringify(log.detail)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination-bar">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                &larr; Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
