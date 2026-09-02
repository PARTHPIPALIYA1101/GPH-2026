import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '../services/api.js';

// Custom Map Marker Icons using HTML DivIcons for crisp control room appearance
function createClusterIcon(cluster) {
  const count = cluster.count;
  const isSingle = count === 1;
  const mainStatus = isSingle
    ? cluster.cameras[0]?.status || 'ACTIVE'
    : 'CLUSTER';

  let bgColor = '#0f2942';
  if (mainStatus === 'ACTIVE') bgColor = '#059669';
  if (mainStatus === 'OFFLINE') bgColor = '#dc2626';
  if (mainStatus === 'DEGRADED') bgColor = '#d97706';

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background: ${bgColor};
        color: #ffffff;
        border: 2px solid #ffffff;
        border-radius: 50%;
        width: ${isSingle ? 26 : 34}px;
        height: ${isSingle ? 26 : 34}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: ${isSingle ? 11 : 12}px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        font-family: sans-serif;
      ">
        ${isSingle ? 'CAM' : count}
      </div>
    `,
    iconSize: [isSingle ? 26 : 34, isSingle ? 26 : 34],
    iconAnchor: [isSingle ? 13 : 17, isSingle ? 13 : 17]
  });
}

function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const GUJARAT_CITIES = [
  { name: 'All Gujarat', center: [22.2587, 71.1924], zoom: 7 },
  { name: 'Ahmedabad', center: [23.0225, 72.5714], zoom: 12 },
  { name: 'Surat', center: [21.1702, 72.8311], zoom: 12 },
  { name: 'Rajkot', center: [22.3039, 70.8022], zoom: 12 },
  { name: 'Vadodara', center: [22.3072, 73.1812], zoom: 12 },
  { name: 'Gandhinagar', center: [23.2156, 72.6369], zoom: 13 }
];

export function CameraMap({ onSelectCameraForLive }) {
  const [clusters, setClusters] = useState([]);
  const [selectedCity, setSelectedCity] = useState(GUJARAT_CITIES[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadMapData() {
    setLoading(true);
    try {
      const cityParam = selectedCity.name === 'All Gujarat' ? '' : `&city=${encodeURIComponent(selectedCity.name)}`;
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';
      const res = await apiRequest(`/cameras/map?zoom=${selectedCity.zoom}${cityParam}${statusParam}`);
      if (res.success && res.data) {
        setClusters(res.data);
      }
    } catch (err) {
      console.error('Failed to load camera map clusters:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMapData();
  }, [selectedCity, statusFilter]);

  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="filter-bar" style={{ borderBottom: 'none' }}>
        <div className="filter-group">
          <label>Jump to City:</label>
          <select
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

        <div className="filter-group">
          <label>Camera Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Online / Active</option>
            <option value="OFFLINE">Offline</option>
            <option value="DEGRADED">Degraded</option>
            <option value="CONNECTING">Connecting</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-light)' }}>
          {loading ? 'Refreshing authorized cameras...' : `Loaded ${clusters.reduce((acc, c) => acc + c.count, 0)} authorized cameras`}
        </div>
      </div>

      <div style={{ height: 600, width: '100%', position: 'relative' }}>
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
              <Popup>
                <div style={{ minWidth: 220, fontSize: '12px' }}>
                  {cluster.count === 1 && cluster.cameras[0] ? (
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--gov-navy-800)' }}>
                        {cluster.cameras[0].name}
                      </strong>
                      <div style={{ color: 'var(--text-light)', margin: '3px 0' }}>
                        ID: <span className="mono">{cluster.cameras[0].externalId}</span>
                      </div>
                      <div>Dept: <strong>{cluster.cameras[0].department}</strong></div>
                      <div>City: {cluster.cameras[0].city}</div>
                      <div>Location: {cluster.cameras[0].location}</div>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge badge-${cluster.cameras[0].status.toLowerCase()}`}>
                          {cluster.cameras[0].status}
                        </span>
                        {onSelectCameraForLive && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onSelectCameraForLive(cluster.cameras[0])}
                          >
                            Live Feed
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--gov-navy-800)' }}>
                        Camera Cluster ({cluster.count} Cameras)
                      </strong>
                      <div style={{ margin: '6px 0', fontSize: '11.5px' }}>
                        <div>Active: <strong>{cluster.statuses['ACTIVE'] || 0}</strong></div>
                        <div>Offline: <strong>{cluster.statuses['OFFLINE'] || 0}</strong></div>
                        <div>Degraded: <strong>{cluster.statuses['DEGRADED'] || 0}</strong></div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Zoom closer to inspect individual government camera feeds.
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
