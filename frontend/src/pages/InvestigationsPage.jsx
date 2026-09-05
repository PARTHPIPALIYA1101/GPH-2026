import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { FolderKanban, Plus, Search, ShieldAlert, FileText, CheckCircle, Clock, MapPin, Video, Hash, Crosshair, Filter, Activity, AlertTriangle, User, Calendar, X } from 'lucide-react';

export function InvestigationsPage() {
  const { isStateAdmin, isDeptHead, isOfficer, isInvestigator } = useAuth();
  const { showToast, showModal } = useUI();
  const [investigations, setInvestigations] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('TIMELINE');
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  // Filter investigations
  const filteredInvestigations = useMemo(() => {
    return investigations.filter(inv => {
      const matchesSearch = 
        !searchQuery || 
        inv.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        inv.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.targetValue.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [investigations, searchQuery, statusFilter]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', background: 'var(--bg-main)', fontFamily: 'var(--font-family, "Inter", sans-serif)' }}>
      {/* 1. INVESTIGATION PAGE HEADER */}
      <div className="flex justify-between items-end pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <div>
          <h1 className="flex items-center gap-2 m-0" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            <FolderKanban size={16} style={{ color: 'var(--brand-terracotta)' }} />
            INVESTIGATION COMMAND
          </h1>
          <p className="m-0 mt-1" style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Operational Dossiers & Digital Evidence Tracking
          </p>
        </div>
        {(isOfficer || isInvestigator || isDeptHead || isStateAdmin) && (
          <button className="flex items-center gap-2 transition-colors" style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 600, background: 'var(--brand-terracotta)', color: '#fff', border: '1px solid var(--brand-terracotta)', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase' }} onClick={() => { setFormError(''); setShowOpenModal(true); }}>
            <Plus size={14} /> INITIALIZE CASE
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* 2. CASE DIRECTORY PANEL - HIGH DENSITY */}
        <div className="flex flex-col bg-surface overflow-hidden flex-shrink-0" style={{ width: '320px', border: '1px solid var(--border-medium)', borderRadius: '2px', background: 'var(--bg-surface)' }}>
          
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-medium)', background: 'var(--structure-dark)' }}>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CASE DIRECTORY</span>
              <span className="mono flex items-center gap-1" style={{ fontSize: '10px', color: '#CBD5E1' }}>
                <Activity size={10} style={{ color: 'var(--status-success)' }} />
                {filteredInvestigations.length} ACTIVE
              </span>
            </div>
            
            {/* 3. SEARCH & FILTERS */}
            <div className="flex flex-col gap-2">
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search case ID, title, target..." 
                  style={{ padding: '4px 24px', fontSize: '11px', width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', outline: 'none' }} 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 6, top: 7, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <select 
                  style={{ fontSize: '10px', padding: '4px 6px', width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-medium)', color: statusFilter !== 'ALL' ? 'var(--text-primary)' : 'var(--text-secondary)', outline: 'none' }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">ALL STATUS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
                <select style={{ fontSize: '10px', padding: '4px 6px', width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', outline: 'none' }}>
                  <option value="ALL">ALL PRIORITY</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="NORMAL">NORMAL</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>
            {investigations.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
                {loading ? 'LOADING CASES...' : 'NO ACTIVE CASES'}
              </div>
            ) : filteredInvestigations.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
                NO MATCHES FOUND
              </div>
            ) : (
              <div>
                {filteredInvestigations.map((inv) => {
                  const isSelected = selectedCase?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => { loadCaseDetails(inv.id); setActiveTab('TIMELINE'); }}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border-medium)',
                        background: isSelected ? '#1E293B' : 'transparent',
                        borderLeft: `4px solid ${isSelected ? '#E58A24' : 'transparent'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-main)';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <strong className="mono" style={{ fontSize: '10px', color: isSelected ? '#E58A24' : 'var(--text-secondary)', letterSpacing: '0.05em' }}>{inv.caseNumber}</strong>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '2px',
                          border: `1px solid ${inv.status === 'ACTIVE' ? 'var(--status-success)' : 'var(--border-medium)'}`,
                          color: inv.status === 'ACTIVE' ? (isSelected ? '#10B981' : 'var(--status-success)') : (isSelected ? '#94A3B8' : 'var(--text-muted)'),
                          background: inv.status === 'ACTIVE' ? (isSelected ? 'rgba(16,185,129,0.15)' : 'var(--status-success-bg)') : 'transparent'
                        }}>
                          {inv.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#F8FAFC' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.title}</div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1" style={{ fontSize: '10px', color: isSelected ? '#CBD5E1' : 'var(--text-muted)' }}>
                          <Crosshair size={10} style={{ color: isSelected ? '#E58A24' : 'var(--accent-saffron)' }} /> <span className="mono" style={{ color: isSelected ? '#F8FAFC' : 'var(--text-primary)' }}>{inv.targetValue}</span>
                        </div>
                        <div className="flex items-center gap-1" style={{ fontSize: '10px', color: isSelected ? '#CBD5E1' : 'var(--text-muted)' }}>
                          <Activity size={10} /> {inv.matchCount || 0}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. CASE DOSSIER PANEL - MAIN HERO AREA */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ border: '1px solid var(--border-medium)', borderRadius: '2px', background: 'var(--bg-surface)' }}>
          {selectedCase ? (
            <>
              {/* DOSSIER HERO AREA */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-medium)', background: 'var(--structure-dark)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="mono" style={{ fontSize: '12px', color: '#CBD5E1', background: '#151C22', padding: '2px 8px', border: '1px solid #3A4A58', borderRadius: '2px' }}>{selectedCase.caseNumber}</span>
                      <span style={{ fontSize: '10px', color: selectedCase.status === 'ACTIVE' ? '#10B981' : '#94A3B8', border: `1px solid ${selectedCase.status === 'ACTIVE' ? '#10B981' : '#475569'}`, background: selectedCase.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'transparent', padding: '2px 8px', letterSpacing: '0.05em', fontWeight: 600, borderRadius: '2px' }}>{selectedCase.status}</span>
                      <span style={{ fontSize: '10px', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', letterSpacing: '0.05em', fontWeight: 600, borderRadius: '2px' }}>HIGH PRIORITY</span>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F8FAFC', margin: 0, letterSpacing: '0.01em' }}>{selectedCase.title}</h2>
                  </div>
                  
                  {/* Actions - Command Hierarchy */}
                  <div className="flex gap-2">
                    {(isDeptHead || isStateAdmin) && selectedCase.status !== 'RESOLVED' && (
                      <button className="flex items-center gap-2 transition-colors hover:bg-opacity-80" onClick={handleDecisionClick} style={{ fontSize: '11px', padding: '6px 14px', background: 'var(--status-success)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '2px', fontWeight: 600 }}>
                        <CheckCircle size={12} /> RECORD DECISION
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 5. OPERATIONAL INTELLIGENCE STRIP */}
                <div className="flex" style={{ border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                  <div className="flex-1 flex flex-col gap-1" style={{ padding: '10px 16px', background: 'var(--bg-main)', borderRight: '1px solid var(--border-medium)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>TARGET IDENTIFIER</span>
                    <span className="mono flex items-center gap-2" style={{ fontSize: '14px', color: 'var(--brand-terracotta)', fontWeight: 700 }}><Crosshair size={12} /> {selectedCase.targetValue}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1" style={{ padding: '10px 16px', background: 'var(--bg-main)', borderRight: '1px solid var(--border-medium)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>TOTAL DETECTIONS</span>
                    <span className="mono flex items-center gap-2" style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}><Activity size={12} /> {selectedCase.matches?.length || 0}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1" style={{ padding: '10px 16px', background: 'var(--bg-main)', borderRight: '1px solid var(--border-medium)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>LEAD INVESTIGATOR</span>
                    <span className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><User size={12} /> {selectedCase.leadInvestigatorName || selectedCase.createdByName || 'Unassigned'}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1" style={{ padding: '10px 16px', background: 'var(--bg-main)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>OPENED DATE</span>
                    <span className="mono flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}><Calendar size={12} /> {new Date(selectedCase.createdAt).toISOString().split('T')[0]}</span>
                  </div>
                </div>
              </div>

              {/* DOSSIER TABS */}
              <div className="flex" style={{ borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-main)' }}>
                {[
                  { id: 'TIMELINE', label: 'FORENSIC TIMELINE', icon: <Clock size={12} /> },
                  { id: 'OVERVIEW', label: 'CASE BRIEF', icon: <FileText size={12} /> },
                  { id: 'EVIDENCE', label: 'SECURE EVIDENCE LOCKER', icon: <ShieldAlert size={12} /> }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-2 transition-colors"
                    style={{
                      padding: '12px 20px',
                      background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                      border: 'none',
                      borderTop: `2px solid ${activeTab === tab.id ? 'var(--brand-terracotta)' : 'transparent'}`,
                      borderRight: '1px solid var(--border-medium)',
                      color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* DOSSIER CONTENT */}
              <div className="flex-1 overflow-y-auto" style={{ padding: '24px', background: 'var(--bg-surface)' }}>
                
                {/* 5. CASE BRIEF */}
                {activeTab === 'OVERVIEW' && (
                  <div className="flex flex-col gap-6" style={{ maxWidth: '800px' }}>
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-medium)', padding: '20px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px' }}>OFFICIAL CASE BRIEF</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedCase.description}</div>
                    </div>
                    
                    {selectedCase.decisionNotes && (
                      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-medium)', borderLeft: '3px solid var(--status-success)', padding: '20px', borderRadius: '4px' }}>
                         <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--status-success)', letterSpacing: '0.05em', marginBottom: '16px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px' }}>RESOLUTION LOG</div>
                         <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '12px' }}>{selectedCase.decisionNotes}</div>
                         <div className="flex items-center gap-2" style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '6px 12px', border: '1px solid var(--border-medium)', borderRadius: '2px', display: 'inline-flex' }}>
                           <span className="mono">{new Date(selectedCase.decidedAt).toISOString().substring(0, 16).replace('T', ' ')}</span> | AUTHORIZED BY: {selectedCase.decidedByName}
                         </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. INVESTIGATION TIMELINE / ACTIVITY */}
                {activeTab === 'TIMELINE' && (
                  <div style={{ maxWidth: '800px' }}>
                    {(!selectedCase.matches || selectedCase.matches.length === 0) ? (
                      <div style={{ padding: '16px', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}>
                        <AlertTriangle size={14} /> NO FORENSIC EVENTS RECORDED YET.
                      </div>
                    ) : (
                      <div className="flex flex-col" style={{ paddingLeft: '8px' }}>
                        {selectedCase.matches.map((m, idx) => (
                          <div key={m.id} className="flex" style={{ position: 'relative', paddingBottom: '32px' }}>
                            {/* Connected timeline line */}
                            {idx !== selectedCase.matches.length - 1 && (
                              <div style={{ position: 'absolute', left: '7px', top: '16px', bottom: '0', width: '2px', background: 'var(--border-medium)' }} />
                            )}
                            
                            {/* Node */}
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--bg-surface)', border: `2px solid ${idx === 0 ? 'var(--brand-terracotta)' : 'var(--text-muted)'}`, zIndex: 2, flexShrink: 0, marginTop: '2px', marginRight: '20px', boxShadow: idx === 0 ? '0 0 0 4px rgba(181, 74, 42, 0.15)' : 'none' }} />
                            
                            {/* Event Content */}
                            <div className="flex-1 flex flex-col gap-2" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '14px 18px', marginTop: '-10px' }}>
                              <div className="flex items-center gap-4">
                                <span className="mono flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}><Clock size={11} /> {new Date(m.detectedAt).toISOString().replace('T', ' ').substring(0, 19)}</span>
                                <span style={{ fontSize: '10px', background: 'var(--structure-dark)', border: '1px solid var(--border-medium)', color: '#FFFFFF', padding: '2px 8px', letterSpacing: '0.05em', borderRadius: '2px', fontWeight: 600 }}>{m.cameraName}</span>
                                <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><MapPin size={11}/> {m.cityName}</span>
                                <span className="mono flex items-center gap-1 ml-auto" style={{ fontSize: '10px', fontWeight: 700, color: m.confidence > 0.8 ? 'var(--status-success)' : 'var(--status-warning)', background: m.confidence > 0.8 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)', padding: '2px 8px', border: `1px solid ${m.confidence > 0.8 ? 'rgba(52,120,91,0.3)' : 'rgba(168,106,23,0.3)'}`, borderRadius: '2px' }}>
                                  <Crosshair size={10} /> {Math.round(m.confidence * 100)}% CONFIDENCE
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                Target <span className="mono" style={{ color: 'var(--brand-terracotta)', fontWeight: 700, padding: '2px 8px', border: '1px solid var(--border-medium)', background: 'var(--bg-surface)', borderRadius: '2px' }}>{m.plateNumber}</span> was detected at this location.
                              </div>
                              {m.notes && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', borderLeft: '3px solid var(--border-medium)', paddingLeft: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                                  {m.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 7. EVIDENCE LOCKER */}
                {activeTab === 'EVIDENCE' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DIGITAL EVIDENCE LEDGER</div>
                      <button className="flex items-center gap-2" disabled style={{ padding: '6px 12px', fontSize: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'not-allowed', fontWeight: 600, borderRadius: '2px' }}>
                        <Plus size={12} /> ATTACH EVIDENCE
                      </button>
                    </div>
                    
                    {(!selectedCase.evidence || selectedCase.evidence.length === 0) ? (
                      <div style={{ padding: '16px', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '4px' }}>
                        <AlertTriangle size={14} /> NO EVIDENCE ASSETS ATTACHED.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid var(--border-medium)', borderRadius: '4px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-medium)', background: 'var(--structure-dark)' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.05em' }}>ASSET TYPE</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.05em' }}>IDENTIFIER / TITLE</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.05em' }}>SOURCE</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.05em' }}>INTEGRITY HASH (SHA256)</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.05em' }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCase.evidence.map((ev) => (
                            <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-main)' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                <div className="flex items-center gap-2">
                                  <FileText size={12} />
                                  <span style={{ letterSpacing: '0.02em', fontWeight: 500 }}>{ev.sourceType === 'REPORT_DOCUMENT' ? 'DOCUMENT' : 'MEDIA'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{ev.title}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{ev.sourceType}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span className="mono" style={{ fontSize: '10px', color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '4px 6px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>{ev.hashSha256 || 'PENDING'}</span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <button style={{ padding: '6px 12px', fontSize: '10px', background: 'var(--structure-dark)', border: '1px solid var(--border-medium)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05em', borderRadius: '2px' }}>VIEW</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: 'var(--text-muted)' }}>
              <FolderKanban size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em' }}>SELECT A CASE DOSSIER</div>
              <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>Select a case from the directory to view its forensic timeline.</div>
            </div>
          )}
        </div>
      </div>

      {/* INITIALIZE CASE MODAL */}
      {showOpenModal && (
        <div className="modal-backdrop" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-content system-modal initialize-case-modal" style={{ maxWidth: '520px', background: '#FFFDF8', border: '1px solid #D1CEC5', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
            {/* Dark header */}
            <div className="modal-header" style={{ padding: '16px 20px', background: '#0F172A', borderBottom: '2px solid #E58A24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="m-0 flex items-center gap-2" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', color: '#F8FAFC' }}>
                <Plus size={14} style={{ color: '#E58A24' }} />
                INITIALIZE INVESTIGATION
              </h3>
              <button className="modal-close" onClick={() => setShowOpenModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleOpenInvestigation}>
              {/* Light body */}
              <div className="modal-body" style={{ padding: '20px', background: '#FFFDF8' }}>
                {formError && (
                  <div className="flex items-center gap-2 mb-4" style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '12px', fontWeight: 600, borderRadius: '3px' }}>
                    <AlertTriangle size={14} /> {formError}
                  </div>
                )}
                <div className="mb-4">
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', letterSpacing: '0.04em' }}>CASE TITLE *</label>
                  <input type="text" required placeholder="e.g. SG Highway Theft Operation" value={openForm.title} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, title: e.target.value }); }} style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', borderRadius: '3px', padding: '8px 12px', outline: 'none' }} />
                </div>
                <div className="flex gap-4 mb-4">
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', letterSpacing: '0.04em' }}>TARGET IDENTIFIER *</label>
                    <div style={{ position: 'relative' }}>
                      <Crosshair size={12} style={{ position: 'absolute', left: 12, top: 11, color: '#8A929A' }} />
                      <input type="text" className="mono" required placeholder="GJ01AB1234" value={openForm.targetValue} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, targetValue: e.target.value.toUpperCase() }); }} style={{ width: '100%', paddingLeft: '32px', fontSize: '12px', background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', borderRadius: '3px', paddingTop: '8px', paddingBottom: '8px', textTransform: 'uppercase', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', letterSpacing: '0.04em' }}>SEARCH SCHEDULE</label>
                    <div style={{ position: 'relative' }}>
                      <Clock size={12} style={{ position: 'absolute', left: 12, top: 11, color: '#8A929A' }} />
                      <select value={openForm.intervalMinutes} onChange={(e) => setOpenForm({ ...openForm, intervalMinutes: e.target.value })} style={{ width: '100%', paddingLeft: '32px', fontSize: '12px', background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', borderRadius: '3px', paddingTop: '8px', paddingBottom: '8px', outline: 'none' }}>
                        <option value="60">1 HOUR</option>
                        <option value="360">6 HOURS</option>
                        <option value="1440">24 HOURS</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px', letterSpacing: '0.04em' }}>OPERATIONAL BRIEF *</label>
                  <textarea rows="4" required placeholder="Detail parameters and objectives..." value={openForm.description} onChange={(e) => { setFormError(''); setOpenForm({ ...openForm, description: e.target.value }); }} style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', borderRadius: '3px', padding: '8px 12px', resize: 'none', outline: 'none' }} />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 20px', background: '#F4F1EA', borderTop: '1px solid #D1CEC5', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)} style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, background: '#FFFFFF', border: '1px solid #D1CEC5', color: '#171A1C', cursor: 'pointer', letterSpacing: '0.05em', borderRadius: '3px' }}>CANCEL</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '11px', fontWeight: 600, background: '#B54A2A', border: 'none', color: '#fff', cursor: 'pointer', letterSpacing: '0.05em', borderRadius: '3px' }}>INITIALIZE</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

