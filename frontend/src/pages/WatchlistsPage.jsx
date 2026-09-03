import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { List, Plus, Search, Trash2, Edit, Eye, Shield } from 'lucide-react';

export function WatchlistsPage() {
  const { isStateAdmin, isDeptHead, isInvestigator } = useAuth();
  const { showToast, showModal } = useUI();
  const [watchlists, setWatchlists] = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    entityType: 'PLATE',
    scope: 'DEPARTMENT',
    description: ''
  });

  const [itemForm, setItemForm] = useState({
    value: '',
    description: '',
    severity: 'MEDIUM'
  });

  useEffect(() => {
    loadWatchlists();
  }, []);

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

  async function handleCreateWatchlist(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/watchlists', {
        method: 'POST',
        body: createForm
      });
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
        method: 'POST',
        body: itemForm
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
          await apiRequest(`/watchlists/${selectedWatchlist.id}/items/${itemId}`, {
            method: 'DELETE'
          });
          showToast('Target entity removed successfully.', 'success');
          loadWatchlistDetails(selectedWatchlist.id);
          loadWatchlists();
        } catch (err) {
          showToast(`Failed to remove item: ${err.message}`, 'danger');
        }
      }
    });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2"><List size={24} style={{ color: 'var(--brand-terracotta)' }} /> SURVEILLANCE WATCHLISTS</h1>
          <p>Maintain departmental and statewide lookup lists for active suspect targeting.</p>
        </div>
        {(isStateAdmin || isDeptHead || isInvestigator) && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> NEW WATCHLIST
          </button>
        )}
      </div>

      <div className="split-view" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Watchlist Directory */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTIVE LISTS</span>
              <span className="badge badge-info">{watchlists.length}</span>
            </div>
            <div className="form-group mb-1">
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)' }} />
                <input type="text" className="form-control" placeholder="Search watchlists..." style={{ paddingLeft: 30, fontSize: '13px' }} />
              </div>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
            {watchlists.length === 0 ? (
              <div className="empty-state">
                {loading ? 'Loading watchlists...' : 'No active watchlists found.'}
              </div>
            ) : (
              <div className="flex-col gap-2">
                {watchlists.map((wl) => (
                  <div
                    key={wl.id}
                    onClick={() => loadWatchlistDetails(wl.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '2px',
                      border: `1px solid ${selectedWatchlist?.id === wl.id ? 'var(--accent-saffron)' : 'var(--border-light)'}`,
                      backgroundColor: selectedWatchlist?.id === wl.id ? 'rgba(229,138,36,0.05)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{wl.name}</strong>
                      <span className={`badge ${wl.scope === 'GLOBAL' ? 'badge-critical' : 'badge-info'}`} style={{ fontSize: '9px' }}>
                        {wl.scope}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <div>Type: <strong style={{ color: 'var(--text-primary)' }}>{wl.entityType}</strong></div>
                      <div>{wl.itemCount} Targets</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Watchlist Target Items */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
          {selectedWatchlist ? (
            <>
              {/* Header */}
              <div style={{ padding: '24px', background: 'var(--structure-dark)', color: '#fff' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <Shield size={16} style={{ color: 'var(--accent-saffron)' }} />
                    <span className="mono" style={{ fontSize: '12px', color: '#9BA3AB', letterSpacing: '0.05em' }}>{selectedWatchlist.scope} LIST</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddItemModal(true)}>
                    <Plus size={14} /> ADD TARGET
                  </button>
                </div>
                <h2 style={{ fontSize: '20px', color: '#fff', margin: '8px 0' }}>{selectedWatchlist.name}</h2>
                <p style={{ fontSize: '13px', color: '#9BA3AB', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>
                  {selectedWatchlist.description || 'No description provided.'}
                </p>
              </div>

              {/* Targets Table */}
              <div style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target Value</th>
                      <th>Severity</th>
                      <th>Reason / Notes</th>
                      <th>Added On</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedWatchlist.items || selectedWatchlist.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                          <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                          No target entities have been added to this watchlist yet.
                        </td>
                      </tr>
                    ) : (
                      selectedWatchlist.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.value}</strong>
                          </td>
                          <td>
                            <span className={`badge badge-${item.severity.toLowerCase()}`}>
                              {item.severity}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px' }}>
                            <div className="truncate" title={item.description}>{item.description || '—'}</div>
                          </td>
                          <td className="mono text-secondary" style={{ fontSize: '11px' }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', color: 'var(--status-critical)', borderColor: 'rgba(201, 54, 43, 0.2)' }}
                              onClick={() => handleDeleteItem(item.id)}
                              title="Remove Target"
                            >
                              <Trash2 size={14} />
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
            <div className="empty-state" style={{ flex: 1 }}>
              <List size={48} className="empty-state-icon" />
              <div className="empty-state-title">Select a watchlist to view its target entities.</div>
            </div>
          )}
        </div>
      </div>

      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content system-modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>CREATE SURVEILLANCE WATCHLIST</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateWatchlist}>
              <div className="modal-body">
                <div className="form-group mb-2">
                  <label>Watchlist Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Highway Corridor Suspects"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label>Entity Target Type *</label>
                  <select
                    className="form-control"
                    value={createForm.entityType}
                    onChange={(e) => setCreateForm({ ...createForm, entityType: e.target.value })}
                  >
                    <option value="PLATE">LICENSE PLATE (ANPR)</option>
                    <option value="VEHICLE">VEHICLE MODEL / CATEGORY</option>
                    <option value="PERSON">PERSON OF INTEREST</option>
                    <option value="OBJECT">OBJECT / CONTRABAND</option>
                  </select>
                </div>
                {isStateAdmin && (
                  <div className="form-group mb-2">
                    <label>Watchlist Scope</label>
                    <select
                      className="form-control"
                      value={createForm.scope}
                      onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value })}
                    >
                      <option value="DEPARTMENT">DEPARTMENT LEVEL</option>
                      <option value="GLOBAL">STATEWIDE GLOBAL</option>
                    </select>
                  </div>
                )}
                <div className="form-group mb-2">
                  <label>Description / Purpose</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="State the purpose of this surveillance watchlist..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>CANCEL</button>
                <button type="submit" className="btn btn-primary">CREATE WATCHLIST</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="modal-backdrop">
          <div className="modal-content system-modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>ADD TARGET TO WATCHLIST</h3>
              <button className="modal-close" onClick={() => setShowAddItemModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div className="form-group mb-2">
                  <label>Target Value (e.g. Plate No) *</label>
                  <input
                    type="text"
                    className="form-control mono"
                    required
                    style={{ textTransform: 'uppercase' }}
                    placeholder="e.g. GJ01AB9988"
                    value={itemForm.value}
                    onChange={(e) => setItemForm({ ...itemForm, value: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group mb-2">
                  <label>Alert Severity Level</label>
                  <select
                    className="form-control"
                    value={itemForm.severity}
                    onChange={(e) => setItemForm({ ...itemForm, severity: e.target.value })}
                  >
                    <option value="CRITICAL">CRITICAL EMERGENCY</option>
                    <option value="HIGH">HIGH PRIORITY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div className="form-group mb-2">
                  <label>Reason / FIR / Remarks</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="e.g. FIR No 122/2026 - Stolen SUV"
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItemModal(false)}>CANCEL</button>
                <button type="submit" className="btn btn-primary">ADD TARGET</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
