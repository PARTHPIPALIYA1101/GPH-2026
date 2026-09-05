import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../services/api.js';
import { Layers, RefreshCw } from 'lucide-react';

// ── Marker Icons ──────────────────────────────────────────────────────────────
function createClusterIcon(cluster) {
  const count = cluster.count;
  const isSingle = count === 1;
  const mainStatus = isSingle
    ? cluster.cameras[0]?.status || 'ACTIVE'
    : 'CLUSTER';

  let bgColor = '#0f2942';
  let ringColor = 'rgba(255,255,255,0.4)';
  if (mainStatus === 'ACTIVE')   { bgColor = '#059669'; ringColor = 'rgba(5,150,105,0.35)'; }
  if (mainStatus === 'OFFLINE')  { bgColor = '#dc2626'; ringColor = 'rgba(220,38,38,0.35)'; }
  if (mainStatus === 'DEGRADED') { bgColor = '#d97706'; ringColor = 'rgba(217,119,6,0.35)'; }

  const size  = isSingle ? 28 : 36;
  const label = isSingle ? 'CAM' : count;
  const fs    = isSingle ? 10 : 12;

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        position:relative;
        width:${size}px;
        height:${size}px;
      ">
        <!-- Outer halo -->
        <div style="
          position:absolute;
          inset:-5px;
          border-radius:50%;
          background:${ringColor};
          pointer-events:none;
        "></div>
        <!-- Core -->
        <div style="
          position:absolute;
          inset:0;
          background:${bgColor};
          color:#ffffff;
          border:2px solid rgba(255,255,255,0.9);
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:700;
          font-size:${fs}px;
          box-shadow:0 2px 8px rgba(0,0,0,0.45);
          font-family:'JetBrains Mono',monospace;
          letter-spacing:0.02em;
        ">
          ${label}
        </div>
      </div>
    `,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Map View Controller ────────────────────────────────────────────────────────
function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ── City / Region Registry ────────────────────────────────────────────────────
const GUJARAT_CITIES = [
  { name: 'All Gujarat',  center: [22.2587, 71.1924], zoom: 7  },
  { name: 'Ahmedabad',   center: [23.0225, 72.5714], zoom: 12 },
  { name: 'Surat',       center: [21.1702, 72.8311], zoom: 12 },
  { name: 'Rajkot',      center: [22.3039, 70.8022], zoom: 12 },
  { name: 'Vadodara',    center: [22.3072, 73.1812], zoom: 12 },
  { name: 'Gandhinagar', center: [23.2156, 72.6369], zoom: 13 },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export function CameraMap({ onSelectCameraForLive }) {
  const [clusters,      setClusters]      = useState([]);
  const [selectedCity,  setSelectedCity]  = useState(GUJARAT_CITIES[0]);
  const [statusFilter,  setStatusFilter]  = useState('');
  const [loading,       setLoading]       = useState(true);

  async function loadMapData() {
    setLoading(true);
    try {
      const cityParam   = selectedCity.name === 'All Gujarat' ? '' : `&city=${encodeURIComponent(selectedCity.name)}`;
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const res = await apiRequest(`/cameras/map?zoom=${selectedCity.zoom}${cityParam}${statusParam}`);
      if (res.success && res.data) setClusters(res.data);
    } catch (err) {
      console.error('Failed to load camera map clusters:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMapData(); }, [selectedCity, statusFilter]);

  const totalCameras = clusters.reduce((acc, c) => acc + c.count, 0);

  // Status badge colour map for the legend
  const STATUS_COLORS = {
    ACTIVE:     'var(--status-success)',
    OFFLINE:    'var(--status-critical)',
    DEGRADED:   'var(--status-warning)',
    CONNECTING: 'var(--status-info)',
  };

  return (
    <div className="camera-map-panel">
      {/* ── Filter / Control Bar ──────────────────────────────────────── */}
      <div className="camera-map-controls">
        <div className="camera-map-controls-left">
          {/* Region select */}
          <div className="cmc-group">
            <label className="cmc-label">REGION</label>
            <select
              className="cmc-select"
              value={selectedCity.name}
              onChange={(e) => {
                const found = GUJARAT_CITIES.find((c) => c.name === e.target.value);
                if (found) setSelectedCity(found);
              }}
            >
              {GUJARAT_CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="cmc-group">
            <label className="cmc-label">STATUS</label>
            <select
              className="cmc-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Online / Active</option>
              <option value="OFFLINE">Offline</option>
              <option value="DEGRADED">Degraded</option>
              <option value="CONNECTING">Connecting</option>
            </select>
          </div>

          {/* Active filter chip */}
          {statusFilter && (
            <button
              className="cmc-chip"
              onClick={() => setStatusFilter('')}
              title="Clear status filter"
            >
              {statusFilter}
              <span className="cmc-chip-x">×</span>
            </button>
          )}
        </div>

        <div className="camera-map-controls-right">
          {/* Camera count */}
          <div className="cmc-count">
            {loading ? (
              <span className="cmc-loading">
                <RefreshCw size={11} className="cmc-spin" />
                Refreshing…
              </span>
            ) : (
              <>
                <span className="cmc-count-num">{totalCameras}</span>
                <span className="cmc-count-label">authorized cameras</span>
              </>
            )}
          </div>

          {/* Legend */}
          <div className="cmc-legend">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="cmc-legend-item">
                <span className="cmc-legend-dot" style={{ background: color }} />
                <span className="cmc-legend-text">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map Container ─────────────────────────────────────────────── */}
      <div className="camera-map-container">
        {loading && (
          <div className="camera-map-loading">
            <div className="camera-map-loading-inner">
              <RefreshCw size={16} className="cmc-spin" />
              Loading cameras…
            </div>
          </div>
        )}

        <MapContainer
          center={selectedCity.center}
          zoom={selectedCity.zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <MapViewController center={selectedCity.center} zoom={selectedCity.zoom} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors | Gujarat State GIS"
          />

          {clusters.map((cluster) => (
            <Marker
              key={cluster.id}
              position={[cluster.latitude, cluster.longitude]}
              icon={createClusterIcon(cluster)}
            >
              <Popup className="camera-map-popup">
                {cluster.count === 1 && cluster.cameras[0] ? (
                  /* ── Single Camera Popup ── */
                  <div className="cmp-single">
                    <div className="cmp-header">
                      <span className={`badge badge-${cluster.cameras[0].status.toLowerCase()}`}>
                        {cluster.cameras[0].status}
                      </span>
                    </div>
                    <div className="cmp-name">{cluster.cameras[0].name}</div>
                    <div className="cmp-id mono">ID: {cluster.cameras[0].externalId}</div>

                    <div className="cmp-rows">
                      <div className="cmp-row">
                        <span className="cmp-row-label">Dept</span>
                        <span className="cmp-row-val">{cluster.cameras[0].department}</span>
                      </div>
                      <div className="cmp-row">
                        <span className="cmp-row-label">City</span>
                        <span className="cmp-row-val">{cluster.cameras[0].city}</span>
                      </div>
                      <div className="cmp-row">
                        <span className="cmp-row-label">Location</span>
                        <span className="cmp-row-val">{cluster.cameras[0].location}</span>
                      </div>
                    </div>

                    {onSelectCameraForLive && (
                      <button
                        className="btn btn-primary cmp-live-btn"
                        onClick={() => onSelectCameraForLive(cluster.cameras[0])}
                      >
                        ▶ Live Feed
                      </button>
                    )}
                  </div>
                ) : (
                  /* ── Cluster Popup ── */
                  <div className="cmp-cluster">
                    <div className="cmp-name">
                      Camera Cluster
                      <span className="cmp-cluster-count">{cluster.count}</span>
                    </div>
                    <div className="cmp-rows">
                      <div className="cmp-row">
                        <span className="cmp-row-label">Active</span>
                        <span className="cmp-row-val text-success" style={{ fontWeight: 700 }}>
                          {cluster.statuses['ACTIVE'] || 0}
                        </span>
                      </div>
                      <div className="cmp-row">
                        <span className="cmp-row-label">Offline</span>
                        <span className="cmp-row-val text-critical" style={{ fontWeight: 700 }}>
                          {cluster.statuses['OFFLINE'] || 0}
                        </span>
                      </div>
                      <div className="cmp-row">
                        <span className="cmp-row-label">Degraded</span>
                        <span className="cmp-row-val text-warning" style={{ fontWeight: 700 }}>
                          {cluster.statuses['DEGRADED'] || 0}
                        </span>
                      </div>
                    </div>
                    <div className="cmp-cluster-hint">
                      Zoom in to inspect individual camera feeds.
                    </div>
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
