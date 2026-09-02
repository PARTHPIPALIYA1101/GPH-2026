import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function CamerasPage({ onOpenLiveStream }) {
  const { user, isStateAdmin, isDeptHead } = useAuth();
  const [cameras, setCameras] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [cities, setCities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedCameraForAccess, setSelectedCameraForAccess] = useState(null);
  const [selectedCameraDetails, setSelectedCameraDetails] = useState(null);

  // Register Form State
  const [regForm, setRegForm] = useState({
    externalId: '',
    cameraNumber: '',
    name: '',
    departmentId: '',
    cityId: '',
    location: '',
    streamProtocol: 'RTSP',
    streamReference: '',
    latitude: '',
    longitude: ''
  });

  // Access Request Form State
  const [accessForm, setAccessForm] = useState({
    duration: 'TEMPORARY',
    reason: '',
    expiresAt: ''
  });

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadCameras();
  }, [page, selectedCity, selectedDept, selectedStatus, searchQuery]);

  async function loadLookups() {
    try {
      const [citiesRes, deptRes] = await Promise.all([
        apiRequest('/cities'),
        apiRequest('/departments')
      ]);
      if (citiesRes.success) setCities(citiesRes.data || []);
      if (deptRes.success) setDepartments(deptRes.data || []);
    } catch (err) {
      console.error('Failed to load lookup data:', err.message);
    }
  }

  async function loadCameras() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit,
        offset: page * limit,
        ...(selectedCity && { city: selectedCity }),
        ...(selectedDept && { departmentId: selectedDept }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(searchQuery && { search: searchQuery })
      });

      const res = await apiRequest(`/cameras?${params.toString()}`);
      if (res.success && res.data) {
        setCameras(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load cameras:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterCamera(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/cameras', {
        method: 'POST',
        body: {
          ...regForm,
          latitude: regForm.latitude ? Number(regForm.latitude) : undefined,
          longitude: regForm.longitude ? Number(regForm.longitude) : undefined
        }
      });
      if (res.success) {
        alert('Camera registered successfully. Initial status is CONNECTING.');
        setShowRegisterModal(false);
        setRegForm({
          externalId: '', cameraNumber: '', name: '', departmentId: '',
          cityId: '', location: '', streamProtocol: 'RTSP', streamReference: '',
          latitude: '', longitude: ''
        });
        loadCameras();
      }
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    }
  }

  async function handleStartAi(cam) {
    try {
      const res = await apiRequest('/ai/jobs', {
        method: 'POST',
        body: { cameraId: cam.id }
      });
      if (res.success) {
        alert(`AI Processing started for ${cam.name}`);
        loadCameras();
      }
    } catch (err) {
      alert(`Failed to start AI job: ${err.message}`);
    }
  }

  async function handleDeleteCamera(cam) {
    if (!window.confirm(`Are you sure you want to decommission camera "${cam.name}" (${cam.externalId})?`)) {
      return;
    }
    try {
      const res = await apiRequest(`/cameras/${cam.id}`, { method: 'DELETE' });
      if (res.success) {
        alert(`Camera "${cam.name}" has been decommissioned.`);
        setSelectedCameraDetails(null);
        loadCameras();
      }
    } catch (err) {
      alert(`Failed to delete camera: ${err.message}`);
    }
  }

  async function handleRequestAccess(e) {
    e.preventDefault();
    if (!selectedCameraForAccess) return;
    try {
      const res = await apiRequest('/access-requests', {
        method: 'POST',
        body: {
          cameraIds: [selectedCameraForAccess.id],
          duration: accessForm.duration,
          reason: accessForm.reason,
          expiresAt: accessForm.duration === 'TEMPORARY' ? new Date(accessForm.expiresAt).toISOString() : null
        }
      });
      if (res.success) {
        alert('Camera access request submitted successfully.');
        setShowAccessModal(false);
        setSelectedCameraForAccess(null);
        setAccessForm({ duration: 'TEMPORARY', reason: '', expiresAt: '' });
      }
    } catch (err) {
      alert(`Access request failed: ${err.message}`);
    }
  }

  function openRegisterModal() {
    setRegForm({
      externalId: '',
      cameraNumber: '',
      name: '',
      departmentId: user.departmentId || (departments[0] ? departments[0].id : ''),
      cityId: cities[0] ? cities[0].id : '',
      location: '',
      streamProtocol: 'RTSP',
      streamReference: '',
      latitude: '',
      longitude: ''
    });
    setShowRegisterModal(true);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Camera Infrastructure Catalogue</h2>
          <p className="subtitle" style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>Manage Gujarat government video surveillance assets across departments and cities</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(isStateAdmin || isDeptHead) && (
            <button className="btn btn-primary" onClick={openRegisterModal}>
              + Register Camera
            </button>
          )}
        </div>
      </div>


      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search by ID, name, location..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ width: 140 }}>
            <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setPage(0); }}>
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 160 }}>
            <select value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setPage(0); }}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 130 }}>
            <select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="OFFLINE">OFFLINE</option>
              <option value="DEGRADED">DEGRADED</option>
              <option value="CONNECTING">CONNECTING</option>
            </select>
          </div>
        </div>
      </div>

      {/* Camera Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Camera ID</th>
                <th>Name</th>
                <th>City</th>
                <th>Department</th>
                <th>Status</th>
                <th>AI Status</th>
                <th>Coordinates</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading camera assets...</td>
                </tr>
              ) : cameras.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>No camera records found matching filters.</td>
                </tr>
              ) : (
                cameras.map((cam) => (
                  <tr key={cam.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{cam.externalId}</td>
                    <td>
                      <div><strong>{cam.name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cam.location}</div>
                    </td>
                    <td>{cam.city}</td>
                    <td>
                      <span className="badge badge-secondary">{cam.departmentCode || cam.department}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${cam.status === 'ACTIVE' ? 'active' : cam.status === 'OFFLINE' ? 'offline' : 'degraded'}`}>
                        {cam.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${cam.aiStatus === 'PROCESSING' ? 'active' : cam.aiStatus === 'ERROR' ? 'offline' : 'degraded'}`}>
                        {cam.aiStatus}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '11px' }}>
                      {cam.latitude && cam.longitude ? `${cam.latitude.toFixed(4)}, ${cam.longitude.toFixed(4)}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedCameraDetails(cam)}
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenLiveStream && onOpenLiveStream(cam)}
                        >
                          Live
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartAi(cam)}
                          title="Start Sentinel AI YOLO+ANPR Inference"
                        >
                          ⚡ Start AI
                        </button>
                        {(isStateAdmin || (isDeptHead && cam.departmentId === user.departmentId)) && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteCamera(cam)}
                            title="Decommission/Delete camera asset"
                          >
                            Delete
                          </button>
                        )}
                        {cam.departmentId !== user.departmentId && !isStateAdmin && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedCameraForAccess(cam);
                              setShowAccessModal(true);
                            }}
                          >
                            Share Req
                          </button>
                        )}
                      </div>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                &larr; Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Register Camera Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h3>Register New Government Camera</h3>
              <button className="modal-close" onClick={() => setShowRegisterModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegisterCamera}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>External Camera ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GJ-AMD-POL-101"
                      value={regForm.externalId}
                      onChange={(e) => setRegForm({ ...regForm, externalId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Camera Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 101"
                      value={regForm.cameraNumber}
                      onChange={(e) => setRegForm({ ...regForm, cameraNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group full">
                    <label>Camera Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kalupur Railway Station East Junction"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>City *</label>
                    <select
                      required
                      value={regForm.cityId}
                      onChange={(e) => setRegForm({ ...regForm, cityId: e.target.value })}
                    >
                      <option value="">Select City</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.district})</option>
                      ))}
                    </select>
                  </div>
                  {isStateAdmin && (
                    <div className="form-group">
                      <label>Managing Department</label>
                      <select
                        value={regForm.departmentId}
                        onChange={(e) => setRegForm({ ...regForm, departmentId: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group full">
                    <label>Location Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sector 11 Secretariat Entry Gate 1, Gandhinagar"
                      value={regForm.location}
                      onChange={(e) => setRegForm({ ...regForm, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Stream Protocol</label>
                    <select
                      value={regForm.streamProtocol}
                      onChange={(e) => setRegForm({ ...regForm, streamProtocol: e.target.value })}
                    >
                      <option value="RTSP">RTSP Stream</option>
                      <option value="HTTPS-HLS">HTTPS / HLS Stream</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Stream Reference / URI</label>
                    <input
                      type="text"
                      placeholder="rtsp://10.20.1.101:554/live"
                      value={regForm.streamReference}
                      onChange={(e) => setRegForm({ ...regForm, streamReference: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Latitude (Gujarat: 20.0 - 24.5)</label>
                    <input
                      type="text"
                      placeholder="e.g. 23.0225"
                      value={regForm.latitude}
                      onChange={(e) => setRegForm({ ...regForm, latitude: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude (Gujarat: 68.0 - 74.5)</label>
                    <input
                      type="text"
                      placeholder="e.g. 72.5714"
                      value={regForm.longitude}
                      onChange={(e) => setRegForm({ ...regForm, longitude: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Camera Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Request Modal */}
      {showAccessModal && selectedCameraForAccess && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Request Inter-Department Camera Access</h3>
              <button className="modal-close" onClick={() => setShowAccessModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRequestAccess}>
              <div className="modal-body">
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                  <div>Target Camera: <strong>{selectedCameraForAccess.name}</strong></div>
                  <div>Managing Department: <strong>{selectedCameraForAccess.department}</strong></div>
                  <div>City: {selectedCameraForAccess.city}</div>
                </div>

                <div className="form-group">
                  <label>Duration of Access *</label>
                  <select
                    value={accessForm.duration}
                    onChange={(e) => setAccessForm({ ...accessForm, duration: e.target.value })}
                  >
                    <option value="TEMPORARY">Temporary Grant (Time-bound)</option>
                    <option value="PERMANENT">Permanent Grant</option>
                  </select>
                </div>

                {accessForm.duration === 'TEMPORARY' && (
                  <div className="form-group">
                    <label>Expiration Date & Time *</label>
                    <input
                      type="date"
                      required
                      value={accessForm.expiresAt}
                      onChange={(e) => setAccessForm({ ...accessForm, expiresAt: e.target.value })}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Official Justification / Reason *</label>
                  <textarea
                    required
                    rows="3"
                    placeholder="State the official investigation or operational necessity for accessing this camera..."
                    value={accessForm.reason}
                    onChange={(e) => setAccessForm({ ...accessForm, reason: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccessModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Access Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Details Modal */}
      {selectedCameraDetails && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Camera Asset Specification</h3>
              <button className="modal-close" onClick={() => setSelectedCameraDetails(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <table className="gov-table">
                <tbody>
                  <tr><th>External ID</th><td className="mono">{selectedCameraDetails.externalId}</td></tr>
                  <tr><th>Name</th><td><strong>{selectedCameraDetails.name}</strong></td></tr>
                  <tr><th>Managing Dept</th><td>{selectedCameraDetails.department}</td></tr>
                  <tr><th>City & District</th><td>{selectedCameraDetails.city} ({selectedCameraDetails.district})</td></tr>
                  <tr><th>Location</th><td>{selectedCameraDetails.location}</td></tr>
                  <tr><th>Status</th><td><span className={`badge badge-${selectedCameraDetails.status.toLowerCase()}`}>{selectedCameraDetails.status}</span></td></tr>
                  <tr><th>AI Engine State</th><td><span className="badge badge-active">{selectedCameraDetails.aiStatus}</span></td></tr>
                  <tr><th>Stream Protocol</th><td>{selectedCameraDetails.streamProtocol || 'RTSP'}</td></tr>
                  <tr><th>Coordinates</th><td className="mono">{selectedCameraDetails.latitude}, {selectedCameraDetails.longitude}</td></tr>
                  <tr><th>Last Seen</th><td>{selectedCameraDetails.lastSeenAt ? new Date(selectedCameraDetails.lastSeenAt).toLocaleString() : 'Active Now'}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              {(isStateAdmin || (isDeptHead && selectedCameraDetails.departmentId === user.departmentId)) ? (
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteCamera(selectedCameraDetails)}
                >
                  Decommission Camera Asset
                </button>
              ) : <div />}
              <button className="btn btn-secondary" onClick={() => setSelectedCameraDetails(null)}>Close</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
