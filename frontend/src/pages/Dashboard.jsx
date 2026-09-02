import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { apiRequest } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentDetections, setRecentDetections] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [sumRes, detRes, alertRes] = await Promise.all([
          apiRequest('/cameras/summary'),
          apiRequest('/search?limit=8'),
          apiRequest('/alerts?limit=5&status=NEW')
        ]);
        if (sumRes.success) setSummary(sumRes.data);
        if (detRes.success) setRecentDetections(detRes.data?.items || []);
        if (alertRes.success) setRecentAlerts(alertRes.data?.items || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div>
      <div className="breadcrumbs">Home / Operational Control Room</div>
      <div className="page-header">
        <div>
          <h1>Operational Dashboard</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Centralized video intelligence, GIS monitoring, and ANPR surveillance operations for Gujarat.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavLink to="/live" className="btn btn-primary">
            Launch Live Matrix (16-View)
          </NavLink>
          <NavLink to="/map" className="btn btn-secondary">
            Gujarat GIS Map
          </NavLink>
        </div>
      </div>

      {/* Operational Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total Cameras</span>
          <span className="metric-val">{summary?.totalCameras ?? '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label" style={{ color: 'var(--status-active)' }}>Online / Active</span>
          <span className="metric-val" style={{ color: 'var(--status-active)' }}>{summary?.onlineCount ?? '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label" style={{ color: 'var(--status-offline)' }}>Offline Cameras</span>
          <span className="metric-val" style={{ color: 'var(--status-offline)' }}>{summary?.offlineCount ?? '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label" style={{ color: 'var(--status-degraded)' }}>Degraded Streams</span>
          <span className="metric-val" style={{ color: 'var(--status-degraded)' }}>{summary?.degradedCount ?? '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">AI Processing</span>
          <span className="metric-val">{summary?.aiProcessingCount ?? '—'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">AI Errors / Delayed</span>
          <span className="metric-val">{summary?.aiErrorCount ?? '0'}</span>
        </div>
        <div className="metric-card alert-card">
          <span className="metric-label">New Alerts</span>
          <span className="metric-val">{recentAlerts.length}</span>
        </div>
      </section>

      {/* Triage & Recent Intelligence Feeds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Real-time ANPR & Detections Feed */}
        <section className="panel">
          <div className="panel-header">
            <h2>Real-Time AI Detection & ANPR Stream</h2>
            <NavLink to="/search" style={{ fontSize: '11.5px', color: 'var(--gov-navy-700)', textDecoration: 'none', fontWeight: 600 }}>
              Advanced Search &rarr;
            </NavLink>
          </div>
          <div className="data-table-wrapper">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Plate / Entity</th>
                  <th>Camera & City</th>
                  <th>Vehicle</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recentDetections.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--text-light)' }}>
                      {loading ? 'Loading intelligence events...' : 'No detection events found.'}
                    </td>
                  </tr>
                ) : (
                  recentDetections.map((det) => (
                    <tr key={det.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                        {new Date(det.detectedAt).toLocaleTimeString()}
                      </td>
                      <td>
                        <strong className="mono" style={{ color: 'var(--gov-navy-900)' }}>
                          {det.plateNumber || det.detectionType}
                        </strong>
                      </td>
                      <td>
                        <div>{det.cameraName}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{det.cityName} • {det.departmentCode}</span>
                      </td>
                      <td>
                        {det.vehicleColor && det.vehicleType ? `${det.vehicleColor} ${det.vehicleType}` : '—'}
                      </td>
                      <td>
                        <span className="badge badge-active" style={{ fontSize: '10.5px' }}>
                          {Math.round(det.confidence * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Priority Alerts Triage */}
        <section className="panel">
          <div className="panel-header">
            <h2>Critical & High Priority Alerts</h2>
            <NavLink to="/alerts" style={{ fontSize: '11.5px', color: 'var(--gov-navy-700)', textDecoration: 'none', fontWeight: 600 }}>
              View All Alerts &rarr;
            </NavLink>
          </div>
          <div className="panel-body" style={{ padding: 10 }}>
            {recentAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-light)' }}>
                No unresolved critical alerts in queue.
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge badge-${alert.severity.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <strong style={{ fontSize: '12.5px', color: 'var(--gov-navy-900)' }}>
                    {alert.title}
                  </strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {alert.cameraName} ({alert.cityName})
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
