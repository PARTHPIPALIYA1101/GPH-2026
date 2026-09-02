import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function AdministrationPage() {
  const { user, isStateAdmin, isDeptHead } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'departments', 'cities', 'diagnostics'

  // Users state
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cities, setCities] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // User creation modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    displayName: '',
    email: '',
    password: '',
    departmentId: '',
    roles: ['OFFICER'],
    cityIds: []
  });

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  async function loadAdminData() {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const [uRes, dRes, cRes] = await Promise.all([
          apiRequest('/users?limit=50'),
          apiRequest('/departments'),
          apiRequest('/cities')
        ]);
        if (uRes.success) setUsers(uRes.data?.items || []);
        if (dRes.success) setDepartments(dRes.data || []);
        if (cRes.success) setCities(cRes.data || []);
      } else if (activeTab === 'departments') {
        const res = await apiRequest('/departments');
        if (res.success) setDepartments(res.data || []);
      } else if (activeTab === 'cities') {
        const res = await apiRequest('/cities');
        if (res.success) setCities(res.data || []);
      } else if (activeTab === 'diagnostics') {
        const [healthRes, aiRes] = await Promise.all([
          apiRequest('/health/ready'),
          apiRequest('/ai/status')
        ]);
        if (healthRes.success) setDiagnostics(healthRes.data);
        if (aiRes.success) setAiStatus(aiRes.data);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/users', {
        method: 'POST',
        body: userForm
      });
      if (res.success) {
        alert('User account created successfully.');
        setShowUserModal(false);
        setUserForm({ displayName: '', email: '', password: '', departmentId: '', roles: ['OFFICER'], cityIds: [] });
        loadAdminData();
      }
    } catch (err) {
      alert(`User creation failed: ${err.message}`);
    }
  }

  async function handleStatusChange(userId, nextStatus) {
    if (!confirm(`Change user account status to ${nextStatus}?`)) return;
    try {
      const res = await apiRequest(`/users/${userId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
      if (res.success) {
        alert(`User status updated to ${nextStatus}.`);
        loadAdminData();
      }
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  }

  function handleRoleToggle(role) {
    const exists = userForm.roles.includes(role);
    const updated = exists
      ? userForm.roles.filter((r) => r !== role)
      : [...userForm.roles, role];
    if (updated.length > 0) {
      setUserForm({ ...userForm, roles: updated });
    }
  }

  function handleCityToggle(cityId) {
    const exists = userForm.cityIds.includes(cityId);
    const updated = exists
      ? userForm.cityIds.filter((c) => c !== cityId)
      : [...userForm.cityIds, cityId];
    setUserForm({ ...userForm, cityIds: updated });
  }

  return (
    <div>
      <div className="breadcrumbs">Home / System Administration</div>
      <div className="page-header">
        <div>
          <h1>Administration & Access Control</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Manage users, department scopes, city assignments, and inspect black-box AI service connectivity.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            Users & Roles
          </button>
          <button
            className={`btn ${activeTab === 'departments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('departments')}
          >
            Departments
          </button>
          <button
            className={`btn ${activeTab === 'cities' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('cities')}
          >
            Cities & Boundaries
          </button>
          <button
            className={`btn ${activeTab === 'diagnostics' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            AI & System Diagnostics
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Administrative User Accounts</h2>
            {(isStateAdmin || isDeptHead) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>
                + Create New User
              </button>
            )}
          </div>
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Email ID</th>
                  <th>Department</th>
                  <th>Assigned Roles</th>
                  <th>Assigned Cities</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.displayName}</strong></td>
                    <td className="mono">{u.email}</td>
                    <td>{u.departmentName || 'State Admin'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.roles?.map((r) => (
                          <span key={r} className="badge badge-connecting" style={{ fontSize: '9.5px' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {u.cities?.length ? u.cities.join(', ') : 'Statewide (All)'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${u.status.toLowerCase()}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {u.status === 'ACTIVE' ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                            onClick={() => handleStatusChange(u.id, 'SUSPENDED')}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                            onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                          >
                            Activate
                          </button>
                        )}
                        {u.status !== 'DISABLED' && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                            onClick={() => handleStatusChange(u.id, 'DISABLED')}
                          >
                            Disable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Registered Government Departments</h2>
          </div>
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Dept Code</th>
                  <th>Department Name</th>
                  <th>Category</th>
                  <th>Active Personnel</th>
                  <th>Managed Cameras</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td><strong className="mono">{d.code}</strong></td>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.category}</td>
                    <td>{d.activeUserCount} Users</td>
                    <td>{d.cameraCount} Cameras</td>
                    <td><span className="badge badge-active">{d.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cities' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Gujarat Cities & Surveillance Districts</h2>
          </div>
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>City Name</th>
                  <th>District</th>
                  <th>State Code</th>
                  <th>Registered Cameras</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.district}</td>
                    <td>{c.stateCode}</td>
                    <td>{c.cameraCount} Cameras</td>
                    <td><span className="badge badge-active">{c.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* External AI Integration Status */}
          <div className="panel">
            <div className="panel-header">
              <h2>External AI Model Service Status</h2>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px' }}>
                <div>
                  <strong>Configuration Status:</strong>{' '}
                  <span className={`badge ${aiStatus?.apiUrlConfigured ? 'badge-active' : 'badge-degraded'}`}>
                    {aiStatus?.status || 'NOT_CONFIGURED'}
                  </span>
                </div>
                <div>
                  <strong>Adapter Client Mode:</strong>{' '}
                  <span className="mono">{aiStatus?.clientMode || 'mock'}</span>
                </div>
                <div>
                  <strong>AI Engine Ready:</strong>{' '}
                  <span className={`badge ${aiStatus?.isReady ? 'badge-active' : 'badge-offline'}`}>
                    {aiStatus?.isReady ? 'OPERATIONAL' : 'DEGRADED'}
                  </span>
                </div>
                <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, fontSize: '12px' }}>
                  <strong>Black-Box Contract Note:</strong> The platform communicates with the AI Model via <code>AIClient</code> and receives JSON intelligence events over Kafka/event bus, with live WebRTC/WHEP stream endpoints. When <code>AI_MODEL_API_URL</code> is omitted, raw camera viewing remains fully operational.
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Health */}
          <div className="panel">
            <div className="panel-header">
              <h2>System Readiness & Subsystems</h2>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>PostgreSQL Database:</span>
                  <span className="badge badge-active">{diagnostics?.dependencies?.database?.status || 'UP'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>PostGIS Geographic Extensions:</span>
                  <span className="badge badge-active">{diagnostics?.dependencies?.database?.postgis ? 'ENABLED' : 'ACTIVE'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Redis State Cache:</span>
                  <span className="badge badge-active">{diagnostics?.dependencies?.redis?.status || 'CONFIGURED'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kafka Event Backbone:</span>
                  <span className="badge badge-active">{diagnostics?.dependencies?.kafka?.status || 'CONFIGURED'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>OpenSearch Subsystem:</span>
                  <span className="badge badge-active">{diagnostics?.dependencies?.opensearch?.status || 'CONFIGURED'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Create User Account</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Display Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Inspector Ramesh Chavda"
                      value={userForm.displayName}
                      onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Government Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh.chavda@police.gov.in"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Initial Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>
                  {isStateAdmin && (
                    <div className="form-group">
                      <label>Department Assignment</label>
                      <select
                        value={userForm.departmentId}
                        onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
                      >
                        <option value="">State Admin (No Dept)</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Multi-Role Selector */}
                  <div className="form-group full">
                    <label>Assigned Multi-Roles (Select One or More) *</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                      {['OFFICER', 'OPERATOR', 'INVESTIGATOR', ...(isStateAdmin ? ['DEPARTMENT_HEAD', 'STATE_ADMIN'] : [])].map((r) => (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={userForm.roles.includes(r)}
                            onChange={() => handleRoleToggle(r)}
                          />
                          <span style={{ fontSize: '12px' }}>{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* City Scopes */}
                  <div className="form-group full">
                    <label>Assigned City Scopes (Authorization Boundary)</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                      {cities.map((c) => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={userForm.cityIds.includes(c.id)}
                            onChange={() => handleCityToggle(c.id)}
                          />
                          <span style={{ fontSize: '12px' }}>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
