import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { List, Plus, Search, Trash2, Shield, Globe, Building2, Loader, X, Target } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ENTITY_TYPE_LABELS = {
  PLATE:   'License Plate (ANPR)',
  VEHICLE: 'Vehicle Model',
  PERSON:  'Person of Interest',
  OBJECT:  'Object / Contraband',
};

const SEVERITY_BADGE = {
  CRITICAL: 'badge-critical',
  HIGH:     'badge-high',
  MEDIUM:   'badge-medium',
  LOW:      'badge-low',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function WatchlistsPage() {
  const { isStateAdmin, isDeptHead, isInvestigator } = useAuth();
  const { showToast, showModal } = useUI();

  const [watchlists,        setWatchlists]        = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [searchQuery,       setSearchQuery]       = useState('');

  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '', entityType: 'PLATE', scope: 'DEPARTMENT', description: ''
  });

  const [itemForm, setItemForm] = useState({
    value: '', description: '', severity: 'MEDIUM'
  });

  useEffect(() => { loadWatchlists(); }, []);

  /* ── data loaders ── */
  async function loadWatchlists() {
    setLoading(true);
    try {
      const res = await apiRequest('/watchlists');
      if (res.success && res.data) {
        setWatchlists(res.data || []);
        if (res.data.length > 0 && !selectedWatchlist) {
          loadWatchlistDetails(res.data[0].id);
        }
      }
    } catch (err) {
      showToast(`Failed to load watchlists: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }

  async function loadWatchlistDetails(id) {
    try {
      const res = await apiRequest(`/watchlists/${id}`);
      if (res.success && res.data) {
        setSelectedWatchlist(res.data);
      }
    } catch (err) {
      showToast(`Failed to load watchlist details: ${err.message}`, 'danger');
    }
  }

  /* ── action handlers — preserved exactly ── */
  async function handleCreateWatchlist(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/watchlists', { method: 'POST', body: createForm });
      if (res.success) {
        showToast('Watchlist created successfully.', 'success');
        setShowCreateModal(false);
        setCreateForm({ name: '', entityType: 'PLATE', scope: 'DEPARTMENT', description: '' });
        loadWatchlists();
      }
    } catch (err) {
      showToast(`Failed to create watchlist: ${err.message}`, 'danger');
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!selectedWatchlist) return;
    try {
      const res = await apiRequest(`/watchlists/${selectedWatchlist.id}/items`, {
        method: 'POST', body: itemForm
      });
      if (res.success) {
        showToast('Item added to watchlist.', 'success');
        setShowAddItemModal(false);
        setItemForm({ value: '', description: '', severity: 'MEDIUM' });
        loadWatchlistDetails(selectedWatchlist.id);
        loadWatchlists();
      }
    } catch (err) {
      showToast(`Failed to add item: ${err.message}`, 'danger');
    }
  }

  async function handleDeleteItem(itemId) {
    showModal({
      title: 'Remove Target Entity',
      message: 'Are you sure you want to deactivate this item? It will no longer trigger automatic alerts.',
      confirmText: 'Remove Entity',
      type: 'danger',
      onConfirm: async () => {
        try {
          await apiRequest(`/watchlists/${selectedWatchlist.id}/items/${itemId}`, { method: 'DELETE' });
          showToast('Target entity removed successfully.', 'success');
          loadWatchlistDetails(selectedWatchlist.id);
          loadWatchlists();
        } catch (err) {
          showToast(`Failed to remove item: ${err.message}`, 'danger');
        }
      }
    });
  }

  /* ── filtered list ── */
  const filteredWatchlists = searchQuery
    ? watchlists.filter(wl =>
        wl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wl.entityType.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : watchlists;

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>
            <List size={20} style={{ display:'inline', marginRight:10, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
            Surveillance Watchlists
          </h1>
          <p>Maintain departmental and statewide lookup lists for active suspect targeting.</p>
        </div>
        {(isStateAdmin || isDeptHead || isInvestigator) && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> New Watchlist
          </button>
        )}
      </div>

      {/* ── Split layout ── */}
      <div className="wl-layout">

        {/* ─ Left: directory panel ─ */}
        <div className="panel wl-dir-panel">
          {/* Directory header with search */}
          <div className="panel-header wl-dir-header">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h2 style={{ margin:0 }}>Active Lists</h2>
              <span className="badge badge-info" style={{ fontFamily:'var(--font-mono)' }}>
                {watchlists.length}
              </span>
            </div>
          </div>

          <div className="wl-search-bar">
            <Search size={13} className="wl-search-icon" />
            <input
              type="text"
              className="form-control wl-search-input"
              placeholder="Search watchlists…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="empty-state" style={{ padding:'36px 16px' }}>
              <Loader size={24} className="ev-spinner empty-state-icon" />
              <div className="empty-state-title">Loading Watchlists</div>
            </div>
          )}

          {/* Empty */}
          {!loading && filteredWatchlists.length === 0 && (
            <div className="empty-state" style={{ padding:'36px 16px' }}>
              <div className="empty-state-icon"><List size={28} /></div>
              <div className="empty-state-title">
                {searchQuery ? 'No Results' : 'No Active Watchlists'}
              </div>
              <div className="empty-state-desc">
                {searchQuery ? 'No watchlists match your search.' : 'No active watchlists have been created yet.'}
              </div>
            </div>
          )}

          {/* Watchlist cards */}
          {!loading && filteredWatchlists.length > 0 && (
            <div className="wl-card-list">
              {filteredWatchlists.map((wl) => {
                const isActive = selectedWatchlist?.id === wl.id;
                return (
                  <div
                    key={wl.id}
                    className={isActive ? 'wl-card wl-card--selected' : 'wl-card'}
                    onClick={() => loadWatchlistDetails(wl.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && loadWatchlistDetails(wl.id)}
                  >
                    <div className="wl-card-top">
                      <span className="wl-card-name">{wl.name}</span>
                      <span className={`badge ${wl.scope === 'GLOBAL' ? 'badge-warning' : 'badge-info'}`}
                            style={{ fontSize:9, flexShrink:0 }}>
                        {wl.scope === 'GLOBAL'
                          ? <><Globe size={9} style={{ display:'inline', marginRight:3 }} />GLOBAL</>
                          : <><Building2 size={9} style={{ display:'inline', marginRight:3 }} />DEPT</>
                        }
                      </span>
                    </div>
                    <div className="wl-card-meta">
                      <span className="wl-card-meta-item">
                        <Target size={10} />
                        {ENTITY_TYPE_LABELS[wl.entityType] || wl.entityType}
                      </span>
                      <span className="wl-card-meta-item wl-card-count">
                        {wl.itemCount} {Number(wl.itemCount) === 1 ? 'target' : 'targets'}
                      </span>
                    </div>
                    {wl.departmentName && wl.scope !== 'GLOBAL' && (
                      <div className="wl-card-dept">{wl.departmentName}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─ Right: detail panel ─ */}
        <div className="panel wl-detail-panel">
          {selectedWatchlist ? (
            <>
              {/* Detail header */}
              <div className="wl-detail-header">
                <div className="wl-detail-header-top">
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Shield size={15} style={{ color:'var(--accent-saffron)', flexShrink:0 }} />
                    <div>
                      <div className="wl-detail-name">{selectedWatchlist.name}</div>
                      <div className="wl-detail-scope-line">
                        <span className={`badge ${selectedWatchlist.scope === 'GLOBAL' ? 'badge-warning' : 'badge-info'}`}
                              style={{ fontSize:9 }}>
                          {selectedWatchlist.scope}
                        </span>
                        <span className="wl-detail-type">
                          {ENTITY_TYPE_LABELS[selectedWatchlist.entityType] || selectedWatchlist.entityType}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize:12, padding:'6px 12px' }}
                          onClick={() => setShowAddItemModal(true)}>
                    <Plus size={13} /> Add Target
                  </button>
                </div>

                {selectedWatchlist.description && (
                  <p className="wl-detail-desc">{selectedWatchlist.description}</p>
                )}

                <div className="wl-detail-meta-row">
                  {selectedWatchlist.createdByName && (
                    <span className="wl-detail-meta-chip">
                      Created by <strong>{selectedWatchlist.createdByName}</strong>
                    </span>
                  )}
                  {selectedWatchlist.createdAt && (
                    <span className="wl-detail-meta-chip">{fmt(selectedWatchlist.createdAt)}</span>
                  )}
                  <span className="wl-detail-meta-chip">
                    <strong style={{ fontFamily:'var(--font-mono)' }}>
                      {selectedWatchlist.items?.length ?? 0}
                    </strong> active targets
                  </span>
                </div>
              </div>

              {/* Targets table */}
              <div style={{ overflowX:'auto', flex:1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target Value</th>
                      <th>Severity</th>
                      <th>Reason / Notes</th>
                      <th>Added</th>
                      <th style={{ textAlign:'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedWatchlist.items || selectedWatchlist.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding:0, border:'none' }}>
                          <div className="empty-state" style={{ padding:'48px 20px' }}>
                            <div className="empty-state-icon"><Shield size={28} /></div>
                            <div className="empty-state-title">No Target Entities</div>
                            <div className="empty-state-desc">
                              No items have been added to this watchlist yet.
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      selectedWatchlist.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong className="mono" style={{ fontSize:13, letterSpacing:'0.06em' }}>
                              {item.value}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge ${SEVERITY_BADGE[item.severity] || 'badge-low'}`}>
                              {item.severity}
                            </span>
                          </td>
                          <td style={{ maxWidth:300 }}>
                            <div className="truncate" style={{ fontSize:13 }} title={item.description}>
                              {item.description || '—'}
                            </div>
                          </td>
                          <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                            {fmt(item.createdAt)}
                          </td>
                          <td style={{ textAlign:'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding:'4px 8px', color:'var(--status-critical)', borderColor:'rgba(201,54,43,0.25)' }}
                              onClick={() => handleDeleteItem(item.id)}
                              title="Remove target"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ flex:1, padding:'60px 20px' }}>
              <div className="empty-state-icon"><List size={36} /></div>
              <div className="empty-state-title">No Watchlist Selected</div>
              <div className="empty-state-desc">
                Select a watchlist from the directory to view its target entities.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Create Watchlist Modal ══ */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="system-modal" style={{ maxWidth:500 }}>
            <div className="modal-header">
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'0.05em' }}>
                CREATE SURVEILLANCE WATCHLIST
              </h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateWatchlist}>
              <div className="modal-body">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  <div className="form-group">
                    <label htmlFor="wl-name">Watchlist Name *</label>
                    <input
                      id="wl-name"
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. Highway Corridor Suspects"
                      value={createForm.name}
                      onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="wl-type">Entity Target Type *</label>
                    <select
                      id="wl-type"
                      className="form-control"
                      value={createForm.entityType}
                      onChange={e => setCreateForm({ ...createForm, entityType: e.target.value })}
                    >
                      <option value="PLATE">License Plate (ANPR)</option>
                      <option value="VEHICLE">Vehicle Model / Category</option>
                      <option value="PERSON">Person of Interest</option>
                      <option value="OBJECT">Object / Contraband</option>
                    </select>
                  </div>

                  {isStateAdmin && (
                    <div className="form-group">
                      <label htmlFor="wl-scope">Watchlist Scope</label>
                      <select
                        id="wl-scope"
                        className="form-control"
                        value={createForm.scope}
                        onChange={e => setCreateForm({ ...createForm, scope: e.target.value })}
                      >
                        <option value="DEPARTMENT">Department Level</option>
                        <option value="GLOBAL">Statewide Global</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="wl-desc">Description / Purpose</label>
                    <textarea
                      id="wl-desc"
                      className="form-control"
                      rows="3"
                      placeholder="State the purpose of this surveillance watchlist…"
                      value={createForm.description}
                      onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                    />
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={13} /> Create Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Add Target Item Modal ══ */}
      {showAddItemModal && (
        <div className="modal-backdrop">
          <div className="system-modal" style={{ maxWidth:500 }}>
            <div className="modal-header">
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'0.05em' }}>
                ADD TARGET TO WATCHLIST
              </h3>
              <button className="modal-close" onClick={() => setShowAddItemModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  {selectedWatchlist && (
                    <div className="wl-modal-context">
                      Adding to: <strong>{selectedWatchlist.name}</strong>
                      <span className="badge badge-info" style={{ marginLeft:8, fontSize:9 }}>
                        {ENTITY_TYPE_LABELS[selectedWatchlist.entityType] || selectedWatchlist.entityType}
                      </span>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="item-value">Target Value *</label>
                    <input
                      id="item-value"
                      type="text"
                      className="form-control mono"
                      required
                      style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}
                      placeholder="e.g. GJ01AB9988"
                      value={itemForm.value}
                      onChange={e => setItemForm({ ...itemForm, value: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="item-severity">Alert Severity Level</label>
                    <select
                      id="item-severity"
                      className="form-control"
                      value={itemForm.severity}
                      onChange={e => setItemForm({ ...itemForm, severity: e.target.value })}
                    >
                      <option value="CRITICAL">Critical Emergency</option>
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="item-desc">Reason / FIR / Remarks</label>
                    <textarea
                      id="item-desc"
                      className="form-control"
                      rows="3"
                      placeholder="e.g. FIR No 122/2026 – Stolen SUV"
                      value={itemForm.description}
                      onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                    />
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItemModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Target size={13} /> Add Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
