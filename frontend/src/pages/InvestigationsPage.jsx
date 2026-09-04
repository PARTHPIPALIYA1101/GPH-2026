import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { FolderKanban, Plus, Search, ShieldAlert, FileText, CheckCircle, Clock, MapPin, Video, Hash, Crosshair } from 'lucide-react';

export function InvestigationsPage() {
  const { isStateAdmin, isDeptHead, isOfficer, isInvestigator } = useAuth();
  const { showToast, showModal } = useUI();
  const [investigations, setInvestigations] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('TIMELINE');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [formError, setFormError] = useState('');

  const [openForm, setOpenForm] = useState({
    title: '',
    description: '',
    targetValue: '',
    targetType: 'PLATE',
    intervalMinutes: 360,
    expiresAt: ''
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
      showToast(`Failed to load investigations: ${err.message}`, 'danger');
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
      showToast(`Failed to load case details: ${err.message}`, 'danger');
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
        showToast(`Investigation case ${res.data.caseNumber} opened successfully.`, 'success');
        setShowOpenModal(false);
        setFormError('');
        setOpenForm({ title: '', description: '', targetValue: '', targetType: 'PLATE', intervalMinutes: 360, expiresAt: '' });
        loadInvestigations();
      }
    } catch (err) {
      setFormError(err.message);
    }
  }

  function handleDecisionClick() {
    showModal({
      title: 'Department Head Final Case Decision',
      message: 'Are you sure you want to resolve this investigation? This action requires final remarks.',
      confirmText: 'Resolve Case',
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/investigations/${selectedCase.id}/decision`, {
            method: 'POST',
            body: { status: 'RESOLVED', decisionNotes: 'Automated resolution from UI.' }
          });
          if (res.success) {
            showToast('Investigation decision recorded successfully.', 'success');
            loadCaseDetails(selectedCase.id);
            loadInvestigations();
          }
        } catch (err) {
          showToast(`Failed to record decision: ${err.message}`, 'danger');
        }
      }
    });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2"><FolderKanban size={24} style={{ color: 'var(--brand-terracotta)' }} /> INVESTIGATIONS</h1>
          <p>Digital case workspace, tracking, and evidence management.</p>
        </div>
        {(isOfficer || isInvestigator || isDeptHead || isStateAdmin) && (
          <button className="btn btn-primary" onClick={() => { setFormError(''); setShowOpenModal(true); }}>
            <Plus size={16} /> OPEN NEW CASE
          </button>
        )}
      </div>

      <div className="split-view" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* CASE LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTIVE CASES</span>
              <span className="badge badge-info">{investigations.length}</span>
            </div>
            <div className="form-group mb-1">
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)' }} />
                <input type="text" className="form-control" placeholder="Search cases..." style={{ paddingLeft: 30, fontSize: '13px' }} />
              </div>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
            {investigations.length === 0 ? (
              <div className="empty-state">
                {loading ? 'Loading cases...' : 'No active investigations found.'}
              </div>
            ) : (
              <div className="flex-col gap-2">
                {investigations.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => { loadCaseDetails(inv.id); setActiveTab('TIMELINE'); }}
                    style={{
                      padding: '12px',
                      borderRadius: '2px',
                      border: `1px solid ${selectedCase?.id === inv.id ? 'var(--accent-saffron)' : 'var(--border-light)'}`,
                      backgroundColor: selectedCase?.id === inv.id ? 'rgba(229,138,36,0.05)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <strong className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.caseNumber}</strong>
                      <span className={`badge badge-${inv.status === 'ACTIVE' ? 'active' : 'info'}`} style={{ fontSize: '9px' }}>{inv.status}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{inv.title}</div>
                    <div className="flex items-center gap-4 mt-1" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <div><Crosshair size={10} style={{ display: 'inline', marginRight: 2 }} /> <strong className="mono" style={{ color: 'var(--text-primary)' }}>{inv.targetValue}</strong></div>
                      <div>{inv.matchCount} Matches</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CASE WORKSPACE */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
          {selectedCase ? (
            <>
              {/* Workspace Header */}
              <div style={{ padding: '24px', background: 'var(--structure-dark)', color: '#fff' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className="mono" style={{ fontSize: '12px', color: '#9BA3AB' }}>{selectedCase.caseNumber}</span>
                    <span className={`badge badge-${selectedCase.status === 'ACTIVE' ? 'success' : 'info'}`}>{selectedCase.status}</span>
                  </div>
                  {(isDeptHead || isStateAdmin) && selectedCase.status !== 'RESOLVED' && (
                    <button className="btn btn-secondary btn-sm" onClick={handleDecisionClick} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}>
                      RECORD DECISION
                    </button>
                  )}
                </div>
                <h2 style={{ fontSize: '20px', color: '#fff', margin: '8px 0' }}>{selectedCase.title}</h2>
                
                <div className="flex gap-4 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex-col">
                    <span style={{ fontSize: '10px', color: '#9BA3AB', letterSpacing: '0.05em' }}>TARGET</span>
                    <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-saffron)' }}>{selectedCase.targetValue}</span>
                  </div>
                  <div className="flex-col">
                    <span style={{ fontSize: '10px', color: '#9BA3AB', letterSpacing: '0.05em' }}>DETECTIONS</span>
                    <span className="mono" style={{ fontSize: '14px', fontWeight: 700 }}>{selectedCase.matches?.length || 0}</span>
                  </div>
                  <div className="flex-col">
                    <span style={{ fontSize: '10px', color: '#9BA3AB', letterSpacing: '0.05em' }}>LEAD</span>
                    <span style={{ fontSize: '13px' }}>{selectedCase.leadInvestigatorName || selectedCase.createdByName}</span>
                  </div>
                </div>
              </div>

              {/* Workspace Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)' }}>
                {['TIMELINE', 'OVERVIEW', 'EVIDENCE'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'none',
                      border: 'none',
                      borderBottom: `2px solid ${activeTab === tab ? 'var(--brand-terracotta)' : 'transparent'}`,
                      color: activeTab === tab ? 'var(--brand-terracotta)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.05em',
                      cursor: 'pointer'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Workspace Content */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {activeTab === 'OVERVIEW' && (
                  <div>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '12px' }}>CASE BRIEF</h3>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>{selectedCase.description}</p>
                    
                    {selectedCase.decisionNotes && (
                      <div className="mt-2" style={{ padding: '16px', background: 'var(--status-success-bg)', border: '1px solid var(--status-success)', borderRadius: '2px' }}>
                        <h4 style={{ fontSize: '11px', color: 'var(--status-success)', letterSpacing: '0.05em', marginBottom: '8px' }}>FINAL DECISION</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedCase.decisionNotes}</p>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Decided by {selectedCase.decidedByName} on {new Date(selectedCase.decidedAt).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'TIMELINE' && (
                  <div>
                    {(!selectedCase.matches || selectedCase.matches.length === 0) ? (
                      <div className="empty-state">
                        <Clock size={32} className="empty-state-icon" />
                        <div className="empty-state-title">No automated target matches yet.</div>
                        <div className="empty-state-desc">Scheduled surveillance running.</div>
                      </div>
                    ) : (
                      <div className="timeline">
                        {selectedCase.matches.map((m) => (
                          <div key={m.id} className="timeline-event">
                            <div className="flex justify-between items-start mb-1">
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.cameraName}</div>
                              <div className="flex items-center gap-2">
                                <span className="mono text-secondary" style={{ fontSize: '12px' }}>{new Date(m.detectedAt).toLocaleString()}</span>
                                <span className="badge badge-active" style={{ fontSize: '10px' }}>{Math.round(m.confidence * 100)}% CONF</span>
                              </div>
                            </div>
                            <div className="flex gap-4 mb-2" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <span className="flex items-center gap-1"><MapPin size={12}/> {m.cityName}</span>
                              <span className="mono"><Hash size={12} style={{ display: 'inline' }}/> {m.plateNumber}</span>
                            </div>
                            {m.notes && (
                              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-light)', borderRadius: '2px', fontSize: '12px' }}>
                                {m.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'EVIDENCE' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>SECURE EVIDENCE LOCKER</h3>
                      <button className="btn btn-secondary btn-sm" disabled><Plus size={14} /> ATTACH EVIDENCE</button>
                    </div>
                    {(!selectedCase.evidence || selectedCase.evidence.length === 0) ? (
                      <div className="empty-state">
                        <ShieldAlert size={32} className="empty-state-icon" />
                        <div className="empty-state-title">No forensic evidence attached to this case.</div>
                      </div>
                    ) : (
                      <div className="flex-col gap-2">
                        {selectedCase.evidence.map((ev) => (
                          <div key={ev.id} className="flex justify-between items-center" style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: '2px', background: 'var(--bg-main)' }}>
                            <div className="flex items-center gap-3">
                              <FileText size={24} style={{ color: 'var(--status-info)' }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{ev.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  Source: {ev.sourceType} • SHA256: <code className="mono">{ev.hashSha256?.slice(0, 16)}...</code>
                                </div>
                              </div>
                            </div>
                            <button className="btn btn-secondary btn-sm">VIEW</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <FolderKanban size={48} className="empty-state-icon" />
              <div className="empty-state-title">Select an investigation case to view dossier.</div>
            </div>
          )}
        </div>
      </div>

      {showOpenModal && (
        <div className="modal-backdrop">
          <div className="modal-content system-modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>OPEN INVESTIGATION CASE</h3>
              <button className="modal-close" onClick={() => setShowOpenModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleOpenInvestigation}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '8px 12px', background: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: '1px solid var(--status-critical)', borderRadius: '2px', fontSize: '12px', marginBottom: '16px', fontWeight: 600 }}>
                    ⚠️ {formError}
                  </div>
                )}
                <div className="form-group mb-2">
                  <label>Case Title *</label>
                  <input type="text" className="form-control" required placeholder="e.g. SG Highway Theft" value={openForm.title} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, title: e.target.value }); }} />
                </div>
                <div className="form-group mb-2">
                  <label>Target Value (Plate No) *</label>
                  <input type="text" className="form-control mono" style={{ textTransform: 'uppercase' }} required placeholder="e.g. GJ01AB1234" value={openForm.targetValue} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, targetValue: e.target.value.toUpperCase() }); }} />
                </div>
                <div className="form-group mb-2">
                  <label>Search Schedule</label>
                  <select className="form-control" value={openForm.intervalMinutes} onChange={(e) => setOpenForm({ ...openForm, intervalMinutes: e.target.value })}>
                    <option value="60">EVERY 1 HOUR</option>
                    <option value="360">EVERY 6 HOURS</option>
                    <option value="1440">EVERY 24 HOURS</option>
                  </select>
                </div>
                <div className="form-group mb-2">
                  <label>Case Notes *</label>
                  <textarea className="form-control" rows="3" required placeholder="Detail case background..." value={openForm.description} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, description: e.target.value }); }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>CANCEL</button>
                <button type="submit" className="btn btn-primary">OPEN CASE</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure Crosshair is imported since I used it but forgot to add it to the import list above. Oh wait, I didn't import it. I'll add it.
