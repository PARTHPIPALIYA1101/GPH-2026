import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Hash, Clock, User, Camera, FolderOpen, FileImage, FileVideo, FileText, Database, Loader, ChevronRight, X } from 'lucide-react';
import { apiRequest } from '../services/api.js';
import { useUI } from '../contexts/UIContext.jsx';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const EVIDENCE_TYPE_META = {
  IMAGE_SNAPSHOT:    { label: 'Image Snapshot',   icon: <FileImage  size={12} />, badgeClass: 'badge-info' },
  VIDEO_CLIP:        { label: 'Video Clip',        icon: <FileVideo  size={12} />, badgeClass: 'badge-medium' },
  METADATA_JSON:     { label: 'Intelligence JSON', icon: <Database   size={12} />, badgeClass: 'badge-low' },
  REPORT_DOCUMENT:   { label: 'Report Document',   icon: <FileText   size={12} />, badgeClass: 'badge-success' },
};

const SOURCE_TYPE_META = {
  LIVE_SNAPSHOT: { label: 'Live Capture',    badgeClass: 'badge-online' },
  RECORDED_VMS:  { label: 'VMS Recording',   badgeClass: 'badge-active' },
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function truncateHash(hash, len = 20) {
  if (!hash) return '—';
  return hash.slice(0, len) + '…';
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function EvidencePage() {
  const { showToast } = useUI();
  const [evidenceList, setEvidenceList]   = useState([]);
  const [total,        setTotal]          = useState(0);
  const [loading,      setLoading]        = useState(true);
  const [loadError,    setLoadError]      = useState('');
  const [selected,     setSelected]       = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);

  const [form, setForm] = useState({
    title:            '',
    evidenceType:     'IMAGE_SNAPSHOT',
    sourceType:       'LIVE_SNAPSHOT',
    storageReference: ''
  });

  useEffect(() => { loadEvidence(); }, []);

  async function loadEvidence() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiRequest('/evidence');
      if (res.success && res.data) {
        const items = res.data.items || [];
        setEvidenceList(items);
        setTotal(res.data.total || 0);
        // keep selection in sync if the list refreshed
        if (selected) {
          const refreshed = items.find(i => i.id === selected.id);
          setSelected(refreshed || null);
        }
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load evidence items.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEvidence(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/evidence', { method: 'POST', body: form });
      if (res.success) {
        showToast('Evidence record registered with SHA256 integrity verification.', 'success');
        setShowAddModal(false);
        setForm({ title: '', evidenceType: 'IMAGE_SNAPSHOT', sourceType: 'LIVE_SNAPSHOT', storageReference: '' });
        loadEvidence();
      }
    } catch (err) {
      showToast(`Failed to save evidence: ${err.message}`, 'danger');
    }
  }

  /* ── derived ── */
  const typeMeta   = selected ? (EVIDENCE_TYPE_META[selected.evidenceType]  || {}) : {};
  const sourceMeta = selected ? (SOURCE_TYPE_META[selected.sourceType]       || {}) : {};

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Evidence Locker</h1>
          <p>Digital chain of custody with SHA-256 integrity verification. Distinguishes live captures from VMS/NVR recordings.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          Record Evidence Item
        </button>
      </div>

      {/* ── Split layout: list + detail ── */}
      <div className="ev-layout">

        {/* ── Evidence list panel ── */}
        <div className="panel ev-list-panel">
          <div className="panel-header">
            <h2>
              <ShieldAlert size={15} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
              Registered Evidence
              <span className="ev-count-badge">{total}</span>
            </h2>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              Chain of custody preserved
            </span>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <Loader size={28} className="ev-spinner empty-state-icon" />
              <div className="empty-state-title">Loading Evidence Locker</div>
              <div className="empty-state-desc">Retrieving records from secure storage…</div>
            </div>
          )}

          {/* Error state */}
          {!loading && loadError && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon" style={{ color:'var(--status-critical)', opacity:1 }}>
                <ShieldAlert size={28} />
              </div>
              <div className="empty-state-title" style={{ color:'var(--status-critical)' }}>Failed to Load Evidence</div>
              <div className="empty-state-desc">{loadError}</div>
              <button className="btn btn-secondary" style={{ marginTop:14 }} onClick={loadEvidence}>Retry</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadError && evidenceList.length === 0 && (
            <div className="empty-state" style={{ padding: '48px 20px' }}>
              <div className="empty-state-icon"><ShieldAlert size={32} /></div>
              <div className="empty-state-title">No Evidence Recorded</div>
              <div className="empty-state-desc">No items have been registered in the Evidence Locker yet.</div>
            </div>
          )}

          {/* Evidence table */}
          {!loading && !loadError && evidenceList.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table ev-table">
                <thead>
                  <tr>
                    <th>Evidence Title</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Case</th>
                    <th>Exported By</th>
                    <th>Date Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceList.map((ev) => {
                    const tMeta = EVIDENCE_TYPE_META[ev.evidenceType] || {};
                    const sMeta = SOURCE_TYPE_META[ev.sourceType]     || {};
                    const isActive = selected?.id === ev.id;
                    return (
                      <tr
                        key={ev.id}
                        className={isActive ? 'ev-row ev-row--selected' : 'ev-row'}
                        onClick={() => setSelected(isActive ? null : ev)}
                        title="Click to view evidence details"
                      >
                        <td>
                          <div className="ev-title-cell">
                            <div className="ev-title-name">{ev.title}</div>
                            {ev.cameraName && (
                              <div className="ev-title-sub">
                                <Camera size={10} />
                                {ev.cameraName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${tMeta.badgeClass || 'badge-low'}`}>
                            {tMeta.icon} {tMeta.label || ev.evidenceType}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${sMeta.badgeClass || 'badge-info'}`}>
                            {sMeta.label || ev.sourceType}
                          </span>
                        </td>
                        <td>
                          {ev.caseNumber
                            ? <span className="mono ev-case-num">{ev.caseNumber}</span>
                            : <span style={{ color:'var(--text-muted)', fontSize:12 }}>General</span>
                          }
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:13 }}>{ev.exportedByName || '—'}</span>
                        </td>
                        <td style={{ whiteSpace:'nowrap', fontSize:12, color:'var(--text-secondary)' }}>
                          {fmt(ev.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="panel ev-detail-panel">
            <div className="panel-header" style={{ background:'var(--structure-dark)', borderBottom:'3px solid var(--accent-saffron)' }}>
              <h2 style={{ color:'#fff', fontSize:13, margin:0, letterSpacing:'0.06em' }}>EVIDENCE DETAIL</h2>
              <button
                className="btn btn-secondary"
                style={{ padding:'4px 8px', fontSize:11, border:'none', background:'rgba(255,255,255,0.1)', color:'#fff' }}
                onClick={() => setSelected(null)}
                title="Close detail"
              >
                <X size={14} />
              </button>
            </div>

            <div className="panel-body ev-detail-body">

              {/* Title block */}
              <div className="ev-detail-title-block">
                <div className="ev-detail-title">{selected.title}</div>
                <div className="ev-detail-badges">
                  <span className={`badge ${typeMeta.badgeClass || 'badge-low'}`}>
                    {typeMeta.icon} {typeMeta.label || selected.evidenceType}
                  </span>
                  <span className={`badge ${sourceMeta.badgeClass || 'badge-info'}`}>
                    {sourceMeta.label || selected.sourceType}
                  </span>
                </div>
              </div>

              <div className="ev-detail-rule" />

              {/* Metadata rows */}
              <div className="ev-detail-meta">

                {selected.caseNumber && (
                  <div className="ev-meta-row">
                    <span className="ev-meta-label"><FolderOpen size={12} /> Associated Case</span>
                    <span className="ev-meta-value mono">{selected.caseNumber}</span>
                  </div>
                )}

                {selected.cameraName && (
                  <div className="ev-meta-row">
                    <span className="ev-meta-label"><Camera size={12} /> Source Camera</span>
                    <span className="ev-meta-value">{selected.cameraName}</span>
                  </div>
                )}

                <div className="ev-meta-row">
                  <span className="ev-meta-label"><User size={12} /> Exported By</span>
                  <span className="ev-meta-value">{selected.exportedByName || '—'}</span>
                </div>

                <div className="ev-meta-row">
                  <span className="ev-meta-label"><Clock size={12} /> Date Recorded</span>
                  <span className="ev-meta-value">{fmt(selected.createdAt)}</span>
                </div>

                {selected.exportedAt && selected.exportedAt !== selected.createdAt && (
                  <div className="ev-meta-row">
                    <span className="ev-meta-label"><Clock size={12} /> Exported At</span>
                    <span className="ev-meta-value">{fmt(selected.exportedAt)}</span>
                  </div>
                )}

              </div>

              <div className="ev-detail-rule" />

              {/* Integrity hash */}
              <div className="ev-hash-block">
                <div className="ev-hash-label">
                  <Hash size={11} />
                  SHA-256 Integrity Hash
                </div>
                <code className="ev-hash-value mono">{selected.hashSha256 || '—'}</code>
              </div>

              {/* Storage reference */}
              {selected.storageReference && (
                <div className="ev-storage-block">
                  <div className="ev-hash-label">Storage Reference URI</div>
                  <div className="ev-storage-uri">{selected.storageReference}</div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ══ Record Evidence Modal ══ */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="system-modal">
            <div className="modal-header">
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'0.05em' }}>
                RECORD DIGITAL EVIDENCE ASSET
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEvidence}>
              <div className="modal-body">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  <div className="form-group">
                    <label htmlFor="ev-title">Evidence Title *</label>
                    <input
                      id="ev-title"
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. ANPR Plate Capture Frame – SG Highway Intercept"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="ev-type">Evidence Classification *</label>
                    <select
                      id="ev-type"
                      className="form-control"
                      value={form.evidenceType}
                      onChange={(e) => setForm({ ...form, evidenceType: e.target.value })}
                    >
                      <option value="IMAGE_SNAPSHOT">Image Snapshot (JPEG/PNG)</option>
                      <option value="METADATA_JSON">Intelligence Event JSON</option>
                      <option value="VIDEO_CLIP">Video Clip Export</option>
                      <option value="REPORT_DOCUMENT">Official Investigation Report Document</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ev-source">Source Origin *</label>
                    <select
                      id="ev-source"
                      className="form-control"
                      value={form.sourceType}
                      onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                    >
                      <option value="LIVE_SNAPSHOT">Live Stream Capture (Non-seekable)</option>
                      <option value="RECORDED_VMS">Historical VMS / NVR Storage Recording</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ev-storage">Storage Reference URI</label>
                    <input
                      id="ev-storage"
                      type="text"
                      className="form-control"
                      placeholder="https://storage.internal.gov.in/evidence/export_101.bin"
                      value={form.storageReference}
                      onChange={(e) => setForm({ ...form, storageReference: e.target.value })}
                    />
                  </div>

                  <div style={{
                    background: 'var(--accent-saffron-light)',
                    border: '1px solid rgba(229,138,36,0.3)',
                    borderRadius: 2,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: 'var(--status-warning)',
                    fontWeight: 500
                  }}>
                    A SHA-256 integrity hash will be automatically generated and recorded for chain-of-custody compliance.
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <ShieldAlert size={13} />
                  Save to Evidence Locker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
