import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';

export function EvidencePage() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    evidenceType: 'IMAGE_SNAPSHOT',
    sourceType: 'LIVE_SNAPSHOT',
    storageReference: ''
  });

  useEffect(() => {
    loadEvidence();
  }, []);

  async function loadEvidence() {
    setLoading(true);
    try {
      const res = await apiRequest('/evidence');
      if (res.success && res.data) {
        setEvidenceList(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load evidence items:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEvidence(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/evidence', {
        method: 'POST',
        body: form
      });
      if (res.success) {
        alert('Evidence record registered with SHA256 integrity verification.');
        setShowAddModal(false);
        setForm({ title: '', evidenceType: 'IMAGE_SNAPSHOT', sourceType: 'LIVE_SNAPSHOT', storageReference: '' });
        loadEvidence();
      }
    } catch (err) {
      alert(`Failed to save evidence: ${err.message}`);
    }
  }

  return (
    <div>
      <div className="breadcrumbs">Home / Evidence Management Locker</div>
      <div className="page-header">
        <div>
          <h1>Evidence Management & Integrity Locker</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Maintain digital chain of custody with SHA256 hashing. Distinguishes live stream captures from historical VMS/NVR recordings.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Record Evidence Item
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Registered Evidence Items ({total})</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Chain of custody preserved</span>
        </div>
        <div className="data-table-wrapper">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Evidence Title</th>
                <th>Type</th>
                <th>Source Origin</th>
                <th>Associated Case</th>
                <th>SHA256 Integrity Hash</th>
                <th>Exported By</th>
                <th>Exported Date</th>
              </tr>
            </thead>
            <tbody>
              {evidenceList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                    {loading ? 'Loading evidence locker...' : 'No evidence items recorded in the locker.'}
                  </td>
                </tr>
              ) : (
                evidenceList.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <strong>{ev.title}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{ev.cameraName || 'Manual Entry'}</div>
                    </td>
                    <td>
                      <span className="badge badge-connecting">{ev.evidenceType}</span>
                    </td>
                    <td>
                      <span className={`badge ${ev.sourceType === 'LIVE_SNAPSHOT' ? 'badge-active' : 'badge-degraded'}`}>
                        {ev.sourceType}
                      </span>
                    </td>
                    <td>
                      <strong className="mono">{ev.caseNumber || 'General Evidence'}</strong>
                    </td>
                    <td>
                      <code className="mono" style={{ fontSize: '11px', color: 'var(--gov-navy-900)' }}>
                        {ev.hashSha256?.slice(0, 24)}...
                      </code>
                    </td>
                    <td>{ev.exportedByName}</td>
                    <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Evidence Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Digital Evidence Asset</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveEvidence}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Evidence Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ANPR Plate Capture Frame - SG Highway Intercept"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Evidence Classification *</label>
                  <select
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
                  <label>Source Origin (Distinguish Live from Historical) *</label>
                  <select
                    value={form.sourceType}
                    onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                  >
                    <option value="LIVE_SNAPSHOT">Live Stream Capture (Non-seekable)</option>
                    <option value="RECORDED_VMS">Historical VMS/NVR Storage Recording</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Storage Reference URI</label>
                  <input
                    type="text"
                    placeholder="https://storage.internal.gov.in/evidence/export_101.bin"
                    value={form.storageReference}
                    onChange={(e) => setForm({ ...form, storageReference: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Evidence Locker</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
