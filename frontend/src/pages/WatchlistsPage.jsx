import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function WatchlistsPage() {
  const { isStateAdmin, isDeptHead, isInvestigator } = useAuth();
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
      console.error('Failed to load watchlists:', err.message);
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
      alert(`Failed to load watchlist details: ${err.message}`);
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
        alert('Watchlist created successfully.');
        setShowCreateModal(false);
        setCreateForm({ name: '', entityType: 'PLATE', scope: 'DEPARTMENT', description: '' });
        loadWatchlists();
      }
    } catch (err) {
      alert(`Failed to create watchlist: ${err.message}`);
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
        alert('Item added to watchlist.');
        setShowAddItemModal(false);
        setItemForm({ value: '', description: '', severity: 'MEDIUM' });
        loadWatchlistDetails(selectedWatchlist.id);
        loadWatchlists();
      }
    } catch (err) {
      alert(`Failed to add item: ${err.message}`);
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm('Are you sure you want to deactivate this item?')) return;
    try {
      await apiRequest(`/watchlists/${selectedWatchlist.id}/items/${itemId}`, {
        method: 'DELETE'
      });
      loadWatchlistDetails(selectedWatchlist.id);
      loadWatchlists();
    } catch (err) {
      alert(`Failed to remove item: ${err.message}`);
    }
  }

  return (
    <div>
      <div className="breadcrumbs">Home / Watchlist Management</div>
      <div className="page-header">
        <div>
          <h1>Surveillance Watchlists</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Maintain departmental and statewide lookup lists for plates, suspect vehicles, and priority targets.
          </p>
        </div>
        {(isStateAdmin || isDeptHead || isInvestigator) && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Create New Watchlist
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16 }}>
        {/* Watchlist Directory */}
        <div className="panel">
          <div className="panel-header">
            <h2>Active Watchlists</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{watchlists.length} lists</span>
          </div>
          <div className="panel-body" style={{ padding: 8 }}>
            {watchlists.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-light)' }}>
                {loading ? 'Loading watchlists...' : 'No active watchlists found.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {watchlists.map((wl) => (
                  <div
                    key={wl.id}
                    onClick={() => loadWatchlistDetails(wl.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 3,
                      border: `1px solid ${selectedWatchlist?.id === wl.id ? 'var(--gov-navy-800)' : 'var(--border-color)'}`,
                      backgroundColor: selectedWatchlist?.id === wl.id ? '#f1f5f9' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--gov-navy-900)' }}>{wl.name}</strong>
                      <span className={`badge ${wl.scope === 'GLOBAL' ? 'badge-critical' : 'badge-connecting'}`}>
                        {wl.scope}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Entity: <strong>{wl.entityType}</strong> • {wl.itemCount} active targets
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                      Dept: {wl.departmentName || 'Statewide Global'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Watchlist Target Items */}
        <div className="panel">
          <div className="panel-header">
            <h2>
              {selectedWatchlist ? `Targets in "${selectedWatchlist.name}"` : 'Select a Watchlist'}
            </h2>
            {selectedWatchlist && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddItemModal(true)}>
                + Add Target
              </button>
            )}
          </div>

          {selectedWatchlist ? (
            <div>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                <div><strong>Description:</strong> {selectedWatchlist.description || 'No description provided.'}</div>
                <div style={{ marginTop: 3, color: 'var(--text-light)', fontSize: '11px' }}>
                  Scope: {selectedWatchlist.scope} • Created by: {selectedWatchlist.createdByName}
                </div>
              </div>

              <div className="data-table-wrapper">
                <table className="gov-table">
                  <thead>
                    <tr>
                      <th>Target Value</th>
                      <th>Severity</th>
                      <th>Reason / Notes</th>
                      <th>Added On</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedWatchlist.items || selectedWatchlist.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                          No target entities have been added to this watchlist yet.
                        </td>
                      </tr>
                    ) : (
                      selectedWatchlist.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong className="mono" style={{ fontSize: '13px' }}>{item.value}</strong>
                          </td>
                          <td>
                            <span className={`badge badge-${item.severity.toLowerCase()}`}>
                              {item.severity}
                            </span>
                          </td>
                          <td>{item.description || '—'}</td>
                          <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>
              Select a watchlist from the left panel to inspect and manage its target items.
            </div>
          )}
        </div>
      </div>

      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Surveillance Watchlist</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateWatchlist}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Watchlist Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stolen Commercial Vehicles Highway Corridor"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Entity Target Type *</label>
                  <select
                    value={createForm.entityType}
                    onChange={(e) => setCreateForm({ ...createForm, entityType: e.target.value })}
                  >
                    <option value="PLATE">License Plate (ANPR)</option>
                    <option value="VEHICLE">Vehicle Model / Category</option>
                    <option value="PERSON">Person of Interest</option>
                    <option value="OBJECT">Object / Contraband</option>
                    <option value="CAMERA">Camera Asset Perimeter</option>
                  </select>
                </div>
                {isStateAdmin && (
                  <div className="form-group">
                    <label>Watchlist Scope</label>
                    <select
                      value={createForm.scope}
                      onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value })}
                    >
                      <option value="DEPARTMENT">Department Scoped (My Department Only)</option>
                      <option value="GLOBAL">Statewide Global (All Departments)</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Description / Operational Purpose</label>
                  <textarea
                    rows="3"
                    placeholder="State the purpose of this surveillance watchlist..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Watchlist</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Target Entity to Watchlist</h3>
              <button className="modal-close" onClick={() => setShowAddItemModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Target Value (e.g. Plate Number / Identifier) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ01AB9988"
                    value={itemForm.value}
                    onChange={(e) => setItemForm({ ...itemForm, value: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Alert Severity Level</label>
                  <select
                    value={itemForm.severity}
                    onChange={(e) => setItemForm({ ...itemForm, severity: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Reason / FIR / Case Reference</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. FIR No 122/2026 Navrangpura PS - Stolen SUV"
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddItemModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Target Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
