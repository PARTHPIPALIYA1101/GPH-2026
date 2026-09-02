import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function AlertsPage() {
  const { isStateAdmin, isDeptHead } = useAuth();
  const [activeTab, setActiveTab] = useState('triage'); // 'triage' or 'rules'
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [loading, setLoading] = useState(true);

  // Rule creation modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    scope: 'DEPARTMENT',
    severity: 'HIGH',
    conditions: '{"eventType":"ANPR_MATCH","minConfidence":0.85}'
  });

  useEffect(() => {
    if (activeTab === 'triage') {
      loadAlerts();
    } else {
      loadRules();
    }
  }, [activeTab, page, statusFilter, severityFilter]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit,
        offset: page * limit,
        ...(statusFilter && { status: statusFilter }),
        ...(severityFilter && { severity: severityFilter })
      });
      const res = await apiRequest(`/alerts?${params.toString()}`);
      if (res.success && res.data) {
        setAlerts(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRules() {
    setLoading(true);
    try {
      const res = await apiRequest('/alerts/rules');
      if (res.success && res.data) {
        setRules(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load alert rules:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(id) {
    try {
      const res = await apiRequest(`/alerts/${id}/acknowledge`, { method: 'POST' });
      if (res.success) {
        alert('Alert marked as ACKNOWLEDGED.');
        setSelectedAlert(null);
        loadAlerts();
      }
    } catch (err) {
      alert(`Acknowledgement failed: ${err.message}`);
    }
  }

  async function handleResolve(id) {
    if (!resolutionNotes.trim()) {
      alert('Resolution notes are mandatory to resolve an alert.');
      return;
    }
    try {
      const res = await apiRequest(`/alerts/${id}/resolve`, {
        method: 'POST',
        body: { resolutionNotes }
      });
      if (res.success) {
        alert('Alert marked as RESOLVED.');
        setSelectedAlert(null);
        setResolutionNotes('');
        loadAlerts();
      }
    } catch (err) {
      alert(`Resolution failed: ${err.message}`);
    }
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    try {
      let parsedConditions = {};
      try {
        parsedConditions = JSON.parse(ruleForm.conditions);
      } catch {
        alert('Conditions must be a valid JSON object.');
        return;
      }

      const res = await apiRequest('/alerts/rules', {
        method: 'POST',
        body: {
          name: ruleForm.name,
          scope: ruleForm.scope,
          severity: ruleForm.severity,
          conditions: parsedConditions
        }
      });
      if (res.success) {
        alert('Alert rule configured successfully.');
        setShowRuleModal(false);
        setRuleForm({ name: '', scope: 'DEPARTMENT', severity: 'HIGH', conditions: '{"eventType":"ANPR_MATCH"}' });
        loadRules();
      }
    } catch (err) {
      alert(`Failed to create rule: ${err.message}`);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="breadcrumbs">Home / Alert Management Engine</div>
      <div className="page-header">
        <div>
          <h1>Surveillance Alert Operations</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Real-time event notification queue, triage workflow, and data-driven rule management.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'triage' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('triage')}
          >
            Alert Queue & Triage
          </button>
          <button
            className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('rules')}
          >
            Rule Configuration
          </button>
          {activeTab === 'rules' && (isStateAdmin || isDeptHead) && (
            <button className="btn btn-primary" onClick={() => setShowRuleModal(true)}>
              + Configure New Rule
            </button>
          )}
        </div>
      </div>

      {activeTab === 'triage' ? (
        <div className="panel">
          {/* Filters */}
          <div className="filter-bar">
            <div className="filter-group">
              <label>Status:</label>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                <option value="">All Statuses</option>
                <option value="NEW">New (Unacknowledged)</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Severity:</label>
              <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}>
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical Emergency</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-light)' }}>
              Showing {alerts.length} of {total} alerts
            </div>
          </div>

          {/* Alerts Table */}
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Alert Title</th>
                  <th>Camera & Location</th>
                  <th>City</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                      {loading ? 'Refreshing alert queue...' : 'No alerts found in this queue.'}
                    </td>
                  </tr>
                ) : (
                  alerts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge badge-${a.severity.toLowerCase()}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--gov-navy-900)' }}>{a.title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.description}</div>
                      </td>
                      <td>
                        <div>{a.cameraName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{a.cameraLocation}</div>
                      </td>
                      <td>{a.cityName}</td>
                      <td>{a.departmentCode}</td>
                      <td>
                        <span className={`badge badge-${a.status.toLowerCase()}`}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedAlert(a)}
                        >
                          Triage
                        </button>
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
      ) : (
        /* Rules Tab */
        <div className="panel">
          <div className="panel-header">
            <h2>Configured Alert Trigger Rules</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Data-driven rule definitions</span>
          </div>
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Scope</th>
                  <th>Department</th>
                  <th>Severity</th>
                  <th>Rule Trigger Conditions (JSON)</th>
                  <th>Configured By</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                      No alert rules configured.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className="badge badge-connecting">{r.scope}</span></td>
                      <td>{r.departmentName || 'Statewide Global'}</td>
                      <td><span className={`badge badge-${r.severity.toLowerCase()}`}>{r.severity}</span></td>
                      <td><code className="mono" style={{ fontSize: '11px' }}>{JSON.stringify(r.conditions)}</code></td>
                      <td>{r.createdByName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alert Triage Modal */}
      {selectedAlert && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Alert Operational Triage: {selectedAlert.title}</h3>
              <button className="modal-close" onClick={() => setSelectedAlert(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div><strong>Severity:</strong> <span className={`badge badge-${selectedAlert.severity.toLowerCase()}`}>{selectedAlert.severity}</span></div>
                <div><strong>Status:</strong> <span className={`badge badge-${selectedAlert.status.toLowerCase()}`}>{selectedAlert.status}</span></div>
                <div><strong>Camera:</strong> {selectedAlert.cameraName}</div>
                <div><strong>City:</strong> {selectedAlert.cityName}</div>
                <div><strong>Triggered At:</strong> {new Date(selectedAlert.createdAt).toLocaleString()}</div>
                <div><strong>Department:</strong> {selectedAlert.departmentName}</div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, marginBottom: 14 }}>
                <strong>Details:</strong>
                <p style={{ marginTop: 4, fontSize: '12.5px' }}>{selectedAlert.description}</p>
              </div>

              {selectedAlert.status === 'NEW' && (
                <div style={{ marginBottom: 14 }}>
                  <button className="btn btn-primary" onClick={() => handleAcknowledge(selectedAlert.id)}>
                    ✓ Acknowledge Alert (Take Ownership)
                  </button>
                </div>
              )}

              {selectedAlert.status !== 'RESOLVED' && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>Resolution Summary & Action Taken *</label>
                  <textarea
                    rows="3"
                    placeholder="Enter dispatch notes, intercept confirmation, or resolution reason..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-danger" onClick={() => handleResolve(selectedAlert.id)}>
                      Resolve & Close Alert
                    </button>
                  </div>
                </div>
              )}

              {selectedAlert.status === 'RESOLVED' && (
                <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3 }}>
                  <div><strong>Resolved by:</strong> {selectedAlert.resolvedByName} on {new Date(selectedAlert.resolvedAt).toLocaleString()}</div>
                  <div><strong>Notes:</strong> {selectedAlert.resolutionNotes}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedAlert(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showRuleModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configure Alert Trigger Rule</h3>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateRule}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Rule Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. High Priority Stolen Vehicle rajkot ANPR"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  />
                </div>
                {isStateAdmin && (
                  <div className="form-group">
                    <label>Rule Scope</label>
                    <select
                      value={ruleForm.scope}
                      onChange={(e) => setRuleForm({ ...ruleForm, scope: e.target.value })}
                    >
                      <option value="DEPARTMENT">Department Rule</option>
                      <option value="GLOBAL">Statewide Global Rule</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Severity Level</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Condition Definition (JSON) *</label>
                  <textarea
                    rows="4"
                    required
                    className="mono"
                    value={ruleForm.conditions}
                    onChange={(e) => setRuleForm({ ...ruleForm, conditions: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-light)', fontSize: '11px', marginTop: 2 }}>
                    Example: {`{"eventType":"ANPR_MATCH","minConfidence":0.85,"vehicleType":"SUV"}`}
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Alert Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
