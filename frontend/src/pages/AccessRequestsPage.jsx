import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function AccessRequestsPage() {
  const { isStateAdmin, isDeptHead } = useAuth();
  const [direction, setDirection] = useState('incoming'); // 'incoming' or 'outgoing'
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Decision Modal
  const [selectedRequestForDecision, setSelectedRequestForDecision] = useState(null);
  const [decisionForm, setDecisionForm] = useState({
    status: 'APPROVED',
    reason: ''
  });

  useEffect(() => {
    loadRequests();
  }, [direction]);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await apiRequest(`/access-requests?direction=${direction}`);
      if (res.success && res.data) {
        setRequests(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
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
        method: 'POST',
        body: decisionForm
      });
      if (res.success) {
        alert(`Access request ${decisionForm.status.toLowerCase()} successfully.`);
        setSelectedRequestForDecision(null);
        setDecisionForm({ status: 'APPROVED', reason: '' });
        loadRequests();
      }
    } catch (err) {
      alert(`Decision failed: ${err.message}`);
    }
  }

  async function handleRevoke(id) {
    if (!confirm('Are you sure you want to revoke this camera access grant?')) return;
    try {
      const res = await apiRequest(`/access-requests/${id}/revoke`, { method: 'POST' });
      if (res.success) {
        alert('Camera access grant revoked.');
        loadRequests();
      }
    } catch (err) {
      alert(`Revocation failed: ${err.message}`);
    }
  }

  return (
    <div>
      <div className="breadcrumbs">Home / Inter-Department Camera Sharing</div>
      <div className="page-header">
        <div>
          <h1>Camera Access Sharing & Governance</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Manage inter-departmental camera access sharing requests, time-bound approvals, and revocations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn ${direction === 'incoming' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDirection('incoming')}
          >
            Incoming Requests (To Decide)
          </button>
          <button
            className={`btn ${direction === 'outgoing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDirection('outgoing')}
          >
            My Department Requests
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>{direction === 'incoming' ? 'Incoming Access Sharing Requests' : 'Outgoing Access Requests'}</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{total} total records</span>
        </div>
        <div className="data-table-wrapper">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Request Date</th>
                <th>Requesting Department</th>
                <th>Requester</th>
                <th>Cameras</th>
                <th>Duration</th>
                <th>Operational Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                    {loading ? 'Loading requests...' : 'No access requests found in this category.'}
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <strong>{req.requestingDepartment}</strong> ({req.requestingDepartmentCode})
                    </td>
                    <td>{req.requesterName}</td>
                    <td>{req.cameraCount} Camera(s)</td>
                    <td>
                      <span className="badge badge-connecting">{req.duration}</span>
                      {req.expiresAt && (
                        <div style={{ fontSize: '10.5px', color: 'var(--text-light)' }}>
                          Exp: {new Date(req.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>{req.reason}</td>
                    <td>
                      <span className={`badge badge-${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.status === 'PENDING' && (isDeptHead || isStateAdmin) && (
                        <button
                          className="btn btn-primary btn-sm"
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
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRevoke(req.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal */}
      {selectedRequestForDecision && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Decide Camera Access Request</h3>
              <button className="modal-close" onClick={() => setSelectedRequestForDecision(null)}>&times;</button>
            </div>
            <form onSubmit={handleDecisionSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                  <div>Requesting Dept: <strong>{selectedRequestForDecision.requestingDepartment}</strong></div>
                  <div>Requester: {selectedRequestForDecision.requesterName}</div>
                  <div>Duration: {selectedRequestForDecision.duration}</div>
                  <div>Reason: <em>"{selectedRequestForDecision.reason}"</em></div>
                </div>

                <div className="form-group">
                  <label>Official Decision *</label>
                  <select
                    value={decisionForm.status}
                    onChange={(e) => setDecisionForm({ ...decisionForm, status: e.target.value })}
                  >
                    <option value="APPROVED">APPROVE Request</option>
                    <option value="REJECTED">REJECT Request</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Decision Reason / Authorization Remarks *</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Enter the official reason for approval or rejection..."
                    value={decisionForm.reason}
                    onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedRequestForDecision(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
