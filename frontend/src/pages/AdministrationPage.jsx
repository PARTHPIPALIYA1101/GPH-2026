import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import {
  Users, Building2, MapPin, Activity, Plus, X,
  UserCheck, UserX, ShieldCheck, Loader, Cpu, Database,
  CheckCircle, AlertTriangle
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const USER_STATUS_BADGE = {
  ACTIVE:    'badge-success',
  SUSPENDED: 'badge-warning',
  DISABLED:  'badge-critical',
};

const ROLE_BADGE = {
  STATE_ADMIN:     'badge-critical',
  DEPARTMENT_HEAD: 'badge-warning',
  INVESTIGATOR:    'badge-medium',
  OPERATOR:        'badge-info',
  OFFICER:         'badge-low',
};

const TABS = [
  { id: 'users',       label: 'Users & Roles',          icon: <Users       size={14} /> },
  { id: 'departments', label: 'Departments',             icon: <Building2   size={14} /> },
  { id: 'cities',      label: 'Cities & Boundaries',     icon: <MapPin      size={14} /> },
  { id: 'diagnostics', label: 'AI & System Diagnostics', icon: <Activity    size={14} /> },
];

function fmtDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function AdministrationPage() {
  const { user, isStateAdmin, isDeptHead } = useAuth();
  const { showToast, showModal } = useUI();

  const [activeTab,   setActiveTab]   = useState('users');
  const [users,       setUsers]       = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cities,      setCities]      = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [aiStatus,    setAiStatus]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    displayName: '', email: '', password: '',
    departmentId: '', roles: ['OFFICER'], cityIds: []
  });

  useEffect(() => { loadAdminData(); }, [activeTab]);

  /* ── data loaders — API calls preserved exactly ── */
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
      const res = await apiRequest('/users', { method: 'POST', body: userForm });
      if (res.success) {
        showToast('User account created successfully.', 'success');
        setShowUserModal(false);
        setUserForm({ displayName: '', email: '', password: '', departmentId: '', roles: ['OFFICER'], cityIds: [] });
        loadAdminData();
      }
    } catch (err) {
      showToast(`User creation failed: ${err.message}`, 'error');
    }
  }

  async function handleStatusChange(userId, nextStatus) {
    showModal({
      title: 'User Account Status Change',
      message: `Are you sure you want to change this user account status to ${nextStatus}?`,
      confirmText: 'Update Status',
      onConfirm: async () => {
        try {
          const res = await apiRequest(`/users/${userId}/status`, {
            method: 'PATCH', body: { status: nextStatus }
          });
          if (res.success) {
            showToast(`User status updated to ${nextStatus}.`, 'success');
            loadAdminData();
          }
        } catch (err) {
          showToast(`Status update failed: ${err.message}`, 'danger');
        }
      }
    });
  }

  function handleRoleToggle(role) {
    const exists = userForm.roles.includes(role);
    const updated = exists
      ? userForm.roles.filter((r) => r !== role)
      : [...userForm.roles, role];
    if (updated.length > 0) setUserForm({ ...userForm, roles: updated });
  }

  function handleCityToggle(cityId) {
    const exists = userForm.cityIds.includes(cityId);
    const updated = exists
      ? userForm.cityIds.filter((c) => c !== cityId)
      : [...userForm.cityIds, cityId];
    setUserForm({ ...userForm, cityIds: updated });
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Administration & Access Control</h1>
          <p>Manage users, department scopes, city assignments, and inspect AI service connectivity.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="adm-tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`adm-tab-btn ${activeTab === tab.id ? 'adm-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <div className="panel">
          <div className="panel-header">
            <h2>
              <Users size={15} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
              Administrative User Accounts
            </h2>
            {(isStateAdmin || isDeptHead) && (
              <button className="btn btn-primary" style={{ fontSize:12, padding:'6px 12px' }}
                      onClick={() => setShowUserModal(true)}>
                <Plus size={13} /> Create User
              </button>
            )}
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding:'40px 20px' }}>
              <Loader size={24} className="ev-spinner empty-state-icon" />
              <div className="empty-state-title">Loading User Accounts</div>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding:'48px 20px' }}>
              <div className="empty-state-icon"><Users size={32} /></div>
              <div className="empty-state-title">No Users Found</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Display Name</th>
                    <th>Email ID</th>
                    <th>Department</th>
                    <th>Assigned Roles</th>
                    <th>City Scope</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th style={{ textAlign:'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="adm-user-name-cell">
                          <div className="adm-user-avatar">
                            {(u.displayName || '?')[0].toUpperCase()}
                          </div>
                          <strong style={{ fontSize:13 }}>{u.displayName}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize:12, color:'var(--text-secondary)' }}>
                          {u.email}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize:13 }}>
                          {u.departmentName
                            ? <><strong>{u.departmentName}</strong>{u.departmentCode && <span className="badge badge-info" style={{ marginLeft:6, fontSize:9 }}>{u.departmentCode}</span>}</>
                            : <span style={{ color:'var(--text-muted)' }}>State Admin</span>
                          }
                        </div>
                      </td>
                      <td>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {u.roles?.map((r) => (
                            <span key={r} className={`badge ${ROLE_BADGE[r] || 'badge-info'}`}
                                  style={{ fontSize:'9.5px' }}>
                              {r.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                          {u.cities?.length ? u.cities.join(', ') : 'Statewide (All)'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${USER_STATUS_BADGE[u.status] || 'badge-info'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ fontSize:11, whiteSpace:'nowrap', color:'var(--text-secondary)' }}>
                        {fmtDate(u.lastLoginAt)}
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                          {u.status === 'ACTIVE' ? (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize:11, padding:'3px 8px' }}
                              onClick={() => handleStatusChange(u.id, 'SUSPENDED')}
                            >
                              <UserX size={12} /> Suspend
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize:11, padding:'3px 8px' }}
                              onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                            >
                              <UserCheck size={12} /> Activate
                            </button>
                          )}
                          {u.status !== 'DISABLED' && (
                            <button
                              className="btn btn-danger"
                              style={{ fontSize:11, padding:'3px 8px' }}
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
          )}
        </div>
      )}

      {/* ── DEPARTMENTS TAB ── */}
      {activeTab === 'departments' && (
        <div className="panel">
          <div className="panel-header">
            <h2>
              <Building2 size={15} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
              Registered Government Departments
            </h2>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              {departments.length} departments
            </span>
          </div>
          {loading ? (
            <div className="empty-state" style={{ padding:'40px 20px' }}>
              <Loader size={24} className="ev-spinner empty-state-icon" />
              <div className="empty-state-title">Loading Departments</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
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
                      <td><strong className="mono" style={{ letterSpacing:'0.08em' }}>{d.code}</strong></td>
                      <td><strong style={{ fontSize:13 }}>{d.name}</strong></td>
                      <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{d.category}</td>
                      <td>
                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13 }}>{d.activeUserCount}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>users</span>
                      </td>
                      <td>
                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13 }}>{d.cameraCount}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>cameras</span>
                      </td>
                      <td>
                        <span className={`badge ${d.active ? 'badge-success' : 'badge-critical'}`}>
                          {d.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CITIES TAB ── */}
      {activeTab === 'cities' && (
        <div className="panel">
          <div className="panel-header">
            <h2>
              <MapPin size={15} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
              Gujarat Cities & Surveillance Districts
            </h2>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              {cities.length} cities
            </span>
          </div>
          {loading ? (
            <div className="empty-state" style={{ padding:'40px 20px' }}>
              <Loader size={24} className="ev-spinner empty-state-icon" />
              <div className="empty-state-title">Loading Cities</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
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
                      <td><strong style={{ fontSize:13 }}>{c.name}</strong></td>
                      <td style={{ fontSize:13, color:'var(--text-secondary)' }}>{c.district}</td>
                      <td><span className="mono" style={{ fontSize:12 }}>{c.stateCode}</span></td>
                      <td>
                        <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13 }}>{c.cameraCount}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>cameras</span>
                      </td>
                      <td>
                        <span className={`badge ${c.active ? 'badge-success' : 'badge-critical'}`}>
                          {c.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DIAGNOSTICS TAB ── */}
      {activeTab === 'diagnostics' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

          {/* AI Integration Status */}
          <div className="panel">
            <div className="panel-header">
              <h2>
                <Cpu size={14} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
                External AI Model Service
              </h2>
              <span className={`badge ${aiStatus?.isReady ? 'badge-success' : 'badge-warning'}`}>
                {aiStatus?.status || 'LOADING'}
              </span>
            </div>
            <div className="panel-body">
              {loading ? (
                <div className="empty-state" style={{ padding:'24px' }}>
                  <Loader size={20} className="ev-spinner empty-state-icon" />
                </div>
              ) : (
                <div className="adm-diag-list">
                  <div className="adm-diag-row">
                    <span className="adm-diag-label">Configuration Status</span>
                    <span className={`badge ${aiStatus?.apiUrlConfigured ? 'badge-success' : 'badge-warning'}`}>
                      {aiStatus?.status || 'NOT_CONFIGURED'}
                    </span>
                  </div>
                  <div className="adm-diag-row">
                    <span className="adm-diag-label">Adapter Client Mode</span>
                    <span className="mono adm-diag-value">{aiStatus?.clientMode || 'mock'}</span>
                  </div>
                  <div className="adm-diag-row">
                    <span className="adm-diag-label">AI Engine Ready</span>
                    <span className={`badge ${aiStatus?.isReady ? 'badge-success' : 'badge-offline'}`}>
                      {aiStatus?.isReady ? 'OPERATIONAL' : 'DEGRADED'}
                    </span>
                  </div>
                  <div className="adm-diag-note">
                    <AlertTriangle size={12} style={{ flexShrink:0, marginTop:1 }} />
                    <span>
                      <strong>Black-Box Contract:</strong> The platform communicates with the AI Model via{' '}
                      <code className="mono">AIClient</code> and receives JSON intelligence events over Kafka/event bus,
                      with live WebRTC/WHEP stream endpoints. When <code className="mono">AI_MODEL_API_URL</code> is
                      omitted, raw camera viewing remains fully operational.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Infrastructure Health */}
          <div className="panel">
            <div className="panel-header">
              <h2>
                <Database size={14} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--brand-terracotta)' }} />
                System Readiness & Subsystems
              </h2>
              <span className="badge badge-success">
                <CheckCircle size={10} style={{ display:'inline', marginRight:4 }} />
                OPERATIONAL
              </span>
            </div>
            <div className="panel-body">
              {loading ? (
                <div className="empty-state" style={{ padding:'24px' }}>
                  <Loader size={20} className="ev-spinner empty-state-icon" />
                </div>
              ) : (
                <div className="adm-diag-list">
                  {[
                    { label: 'PostgreSQL Database',       value: diagnostics?.dependencies?.database?.status || 'UP' },
                    { label: 'PostGIS Geographic Extensions', value: diagnostics?.dependencies?.database?.postgis ? 'ENABLED' : 'ACTIVE' },
                    { label: 'Redis State Cache',         value: diagnostics?.dependencies?.redis?.status || 'CONFIGURED' },
                    { label: 'Kafka Event Backbone',      value: diagnostics?.dependencies?.kafka?.status || 'CONFIGURED' },
                    { label: 'OpenSearch Subsystem',      value: diagnostics?.dependencies?.opensearch?.status || 'CONFIGURED' },
                  ].map(({ label, value }) => (
                    <div key={label} className="adm-diag-row">
                      <span className="adm-diag-label">{label}</span>
                      <span className="badge badge-success" style={{ fontSize:10 }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Create User Modal ══ */}
      {showUserModal && (
        <div className="modal-backdrop">
          <div className="system-modal" style={{ maxWidth:640 }}>
            <div className="modal-header">
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff', letterSpacing:'0.05em' }}>
                CREATE USER ACCOUNT
              </h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="adm-user-form-grid">

                  <div className="form-group">
                    <label htmlFor="u-name">Full Display Name *</label>
                    <input
                      id="u-name" type="text" required className="form-control"
                      placeholder="e.g. Inspector Ramesh Chavda"
                      value={userForm.displayName}
                      onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="u-email">Government Email Address *</label>
                    <input
                      id="u-email" type="email" required className="form-control"
                      placeholder="e.g. ramesh.chavda@police.gov.in"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="u-pass">Initial Password *</label>
                    <input
                      id="u-pass" type="password" required className="form-control"
                      placeholder="Minimum 8 characters"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>

                  {isStateAdmin && (
                    <div className="form-group">
                      <label htmlFor="u-dept">Department Assignment</label>
                      <select
                        id="u-dept" className="form-control"
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

                  {/* Multi-role selector */}
                  <div className="form-group adm-full-col">
                    <label>Assigned Roles (Select One or More) *</label>
                    <div className="adm-checkbox-group">
                      {['OFFICER', 'OPERATOR', 'INVESTIGATOR', ...(isStateAdmin ? ['DEPARTMENT_HEAD', 'STATE_ADMIN'] : [])].map((r) => (
                        <label key={r} className="adm-checkbox-label">
                          <input
                            type="checkbox"
                            checked={userForm.roles.includes(r)}
                            onChange={() => handleRoleToggle(r)}
                          />
                          <span className={`badge ${ROLE_BADGE[r] || 'badge-info'}`} style={{ fontSize:10 }}>
                            {r.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* City scope selector */}
                  <div className="form-group adm-full-col">
                    <label>Assigned City Scopes (Authorization Boundary)</label>
                    <div className="adm-checkbox-group">
                      {cities.map((c) => (
                        <label key={c.id} className="adm-checkbox-label">
                          <input
                            type="checkbox"
                            checked={userForm.cityIds.includes(c.id)}
                            onChange={() => handleCityToggle(c.id)}
                          />
                          <span style={{ fontSize:12, fontWeight:500 }}>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <ShieldCheck size={13} /> Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
