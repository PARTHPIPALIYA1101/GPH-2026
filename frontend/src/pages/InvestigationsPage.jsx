import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function InvestigationsPage() {
  const { isStateAdmin, isDeptHead, isOfficer, isInvestigator } = useAuth();
  const [investigations, setInvestigations] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [formError, setFormError] = useState('');

  const [openForm, setOpenForm] = useState({
    title: '',
    description: '',
    targetValue: '',
    targetType: 'PLATE',
    intervalMinutes: 360,
    expiresAt: ''
  });

  const [decisionForm, setDecisionForm] = useState({
    status: 'RESOLVED',
    decisionNotes: ''
  });

  useEffect(() => {
    loadInvestigations();
  }, []);

  async function loadInvestigations() {
    setLoading(true);
    try {
      const res = await apiRequest('/investigations');
      if (res.success && res.data) {
        setInvestigations(res.data.items || []);
        if (res.data.items?.length > 0 && !selectedCase) {
          loadCaseDetails(res.data.items[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load investigations:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseDetails(id) {
    try {
      const res = await apiRequest(`/investigations/${id}`);
      if (res.success && res.data) {
        setSelectedCase(res.data);
      }
    } catch (err) {
      alert(`Failed to load case details: ${err.message}`);
    }
  }

  async function handleOpenInvestigation(e) {
    e.preventDefault();
    setFormError('');

    if (openForm.title.trim().length < 5) {
      setFormError('Case Title must be at least 5 characters long.');
      return;
    }
    if (openForm.targetValue.trim().length < 2) {
      setFormError('Target Value must be at least 2 characters long.');
      return;
    }
    if (openForm.description.trim().length < 10) {
      setFormError('Case Brief / Investigation Notes must be at least 10 characters long.');
      return;
    }

    try {
      const res = await apiRequest('/investigations', {
        method: 'POST',
        body: {
          ...openForm,
          intervalMinutes: Number(openForm.intervalMinutes),
          expiresAt: openForm.expiresAt ? new Date(openForm.expiresAt).toISOString() : null
        }
      });
      if (res.success) {
        alert(`Investigation case ${res.data.caseNumber} opened successfully.`);
        setShowOpenModal(false);
        setFormError('');
        setOpenForm({ title: '', description: '', targetValue: '', targetType: 'PLATE', intervalMinutes: 360, expiresAt: '' });
        loadInvestigations();
      }
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDecision(e) {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const res = await apiRequest(`/investigations/${selectedCase.id}/decision`, {
        method: 'POST',
        body: decisionForm
      });
      if (res.success) {
        alert('Investigation decision recorded successfully.');
        setShowDecisionModal(false);
        setDecisionForm({ status: 'RESOLVED', decisionNotes: '' });
        loadCaseDetails(selectedCase.id);
        loadInvestigations();
      }
    } catch (err) {
      alert(`Failed to record decision: ${err.message}`);
    }
  }

  return (
    <div>
      <div className="breadcrumbs">Home / Investigation Casebook</div>
      <div className="page-header">
        <div>
          <h1>Surveillance Investigation Casebook</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Manage active investigations, scheduled repeated searches, target tracking, and evidence collection.
          </p>
        </div>
        {(isOfficer || isInvestigator || isDeptHead || isStateAdmin) && (
          <button className="btn btn-primary" onClick={() => { setFormError(''); setShowOpenModal(true); }}>
            + Open New Case
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16 }}>
        {/* Case List */}
        <div className="panel">
          <div className="panel-header">
            <h2>Active Cases</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{investigations.length} cases</span>
          </div>
          <div className="panel-body" style={{ padding: 8 }}>
            {investigations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-light)' }}>
                {loading ? 'Loading cases...' : 'No active investigations found.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {investigations.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => loadCaseDetails(inv.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 3,
                      border: `1px solid ${selectedCase?.id === inv.id ? 'var(--gov-navy-800)' : 'var(--border-color)'}`,
                      backgroundColor: selectedCase?.id === inv.id ? '#f1f5f9' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong className="mono" style={{ fontSize: '12px', color: 'var(--gov-navy-800)' }}>
                        {inv.caseNumber}
                      </strong>
                      <span className={`badge badge-${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </div>
                    <strong style={{ fontSize: '12.5px' }}>{inv.title}</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Target: <span className="mono" style={{ fontWeight: 700 }}>{inv.targetValue}</span> • {inv.matchCount} Matches
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                      Lead: {inv.leadInvestigatorName || inv.createdByName} • {inv.departmentName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Case Dossier */}
        <div className="panel">
          <div className="panel-header">
            <h2>{selectedCase ? `Case Dossier: ${selectedCase.caseNumber}` : 'Select an Investigation'}</h2>
            {selectedCase && (isDeptHead || isStateAdmin) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowDecisionModal(true)}>
                Record Decision
              </button>
            )}
          </div>

          {selectedCase ? (
            <div>
              {/* Case Overview */}
              <div style={{ padding: 14, background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '14px', marginBottom: 4 }}>{selectedCase.title}</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{selectedCase.description}</p>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: '11.5px' }}>
                  <div>Target Plate: <strong className="mono">{selectedCase.targetValue}</strong></div>
                  <div>Status: <span className={`badge badge-${selectedCase.status.toLowerCase()}`}>{selectedCase.status}</span></div>
                  <div>Expires: {selectedCase.expiresAt ? new Date(selectedCase.expiresAt).toLocaleDateString() : 'Indefinite'}</div>
                </div>
              </div>

              {/* Decision Notes if resolved */}
              {selectedCase.decisionNotes && (
                <div style={{ padding: '10px 14px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', fontSize: '12px' }}>
                  <strong>Final Decision ({selectedCase.status}):</strong>
                  <div style={{ marginTop: 2 }}>{selectedCase.decisionNotes}</div>
                  <div style={{ marginTop: 2, fontSize: '11px', color: 'var(--text-light)' }}>
                    Decided by {selectedCase.decidedByName} on {new Date(selectedCase.decidedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Detection Matches Timeline */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: '#ffffff' }}>
                <h4 style={{ fontSize: '12.5px', marginBottom: 8 }}>Automated Detection Matches ({selectedCase.matches?.length || 0})</h4>
                {(!selectedCase.matches || selectedCase.matches.length === 0) ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', padding: 10 }}>
                    No automated ANPR captures linked to this target yet. Scheduled searches run periodically.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedCase.matches.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '8px 10px',
                          background: '#f8fafc',
                          border: '1px solid var(--border-light)',
                          borderRadius: 3,
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong className="mono" style={{ color: 'var(--gov-navy-900)' }}>{m.plateNumber}</strong>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{m.cameraName} ({m.cityName})</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{m.notes || 'Automated match'}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '11.5px' }}>
                          <div>{new Date(m.detectedAt).toLocaleString()}</div>
                          <span className="badge badge-active">{Math.round(m.confidence * 100)}% Conf</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evidence Gallery */}
              <div style={{ padding: '10px 14px' }}>
                <h4 style={{ fontSize: '12.5px', marginBottom: 8 }}>Attached Evidence ({selectedCase.evidence?.length || 0})</h4>
                {(!selectedCase.evidence || selectedCase.evidence.length === 0) ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', padding: 10 }}>
                    No exported evidence attachments linked to this case yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedCase.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: '8px 10px',
                          background: '#f8fafc',
                          border: '1px solid var(--border-light)',
                          borderRadius: 3,
                          fontSize: '12px'
                        }}
                      >
                        <strong>{ev.title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Type: {ev.evidenceType} • Source: {ev.sourceType} • SHA256: <code className="mono">{ev.hashSha256?.slice(0, 16)}...</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>
              Select an investigation case from the left panel to inspect the dossier and matches.
            </div>
          )}
        </div>
      </div>

      {/* Open Investigation Modal */}
      {showOpenModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Open Surveillance Investigation Case</h3>
              <button className="modal-close" onClick={() => setShowOpenModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleOpenInvestigation}>
              <div className="modal-body">
                {formError && (
                  <div style={{
                    padding: '10px 12px',
                    marginBottom: 12,
                    borderRadius: 4,
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '12.5px',
                    fontWeight: 500
                  }}>
                    ⚠️ {formError}
                  </div>
                )}
                <div className="form-group">
                  <label>Case Title (min 5 chars) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Investigation into SG Highway Luxury Vehicle Theft"
                    value={openForm.title}
                    onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, title: e.target.value }); }}
                  />
                </div>
                <div className="form-group">
                  <label>Target Value (e.g. License Plate Number, min 2 chars) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ01AB1234"
                    value={openForm.targetValue}
                    onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, targetValue: e.target.value }); }}
                  />
                </div>
                <div className="form-group">
                  <label>Auto-Search Schedule Interval (Minutes)</label>
                  <select
                    value={openForm.intervalMinutes}
                    onChange={(e) => setOpenForm({ ...openForm, intervalMinutes: e.target.value })}
                  >
                    <option value="60">Every 1 Hour</option>
                    <option value="180">Every 3 Hours</option>
                    <option value="360">Every 6 Hours (Standard)</option>
                    <option value="720">Every 12 Hours</option>
                    <option value="1440">Every 24 Hours</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Case Expiration Date (Optional)</label>
                  <input
                    type="date"
                    value={openForm.expiresAt}
                    onChange={(e) => setOpenForm({ ...openForm, expiresAt: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Case Brief / Investigation Notes (min 10 chars) *</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Detail the case background, FIR numbers, suspect profile, or operational goals..."
                    value={openForm.description}
                    onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, description: e.target.value }); }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Open Investigation Case</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Department Head Final Case Decision</h3>
              <button className="modal-close" onClick={() => setShowDecisionModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleDecision}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Case Status Decision *</label>
                  <select
                    value={decisionForm.status}
                    onChange={(e) => setDecisionForm({ ...decisionForm, status: e.target.value })}
                  >
                    <option value="RESOLVED">Resolved (Target Intercepted / Recovered)</option>
                    <option value="CLOSED">Closed (Investigation Concluded)</option>
                    <option value="UNDER_REVIEW">Under Review (Further Analysis Required)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Official Decision Justification & Notes *</label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Provide official closure remarks, court forwarding details, or recovery confirmation..."
                    value={decisionForm.decisionNotes}
                    onChange={(e) => setDecisionForm({ ...decisionForm, decisionNotes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDecisionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Final Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
