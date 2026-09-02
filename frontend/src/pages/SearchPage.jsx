import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';

export function SearchPage() {
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [detectionType, setDetectionType] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  const [cities, setCities] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    async function loadCities() {
      try {
        const res = await apiRequest('/cities');
        if (res.success) setCities(res.data || []);
      } catch {
        // city lookup fallback
      }
    }
    loadCities();
    performSearch(0);
  }, []);

  async function performSearch(pageIndex = 0) {
    setLoading(true);
    setPage(pageIndex);
    try {
      const params = new URLSearchParams({
        limit,
        offset: pageIndex * limit,
        minConfidence,
        ...(plateNumber && { plateNumber }),
        ...(vehicleType && { vehicleType }),
        ...(vehicleColor && { vehicleColor }),
        ...(detectionType && { detectionType }),
        ...(selectedCity && { cityId: selectedCity }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo })
      });

      const res = await apiRequest(`/search?${params.toString()}`);
      if (res.success && res.data) {
        setResults(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      alert(`Search query failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportEvidence(det) {
    try {
      const res = await apiRequest('/evidence', {
        method: 'POST',
        body: {
          detectionId: det.id,
          cameraId: det.cameraId,
          evidenceType: 'IMAGE_SNAPSHOT',
          sourceType: 'LIVE_SNAPSHOT',
          title: `ANPR Capture: ${det.plateNumber || 'Vehicle'} at ${det.cameraName}`,
          metadata: { plateNumber: det.plateNumber, confidence: det.confidence, time: det.detectedAt }
        }
      });
      if (res.success) {
        alert(`Evidence record created with SHA256 integrity hash: ${res.data.hashSha256.slice(0, 16)}...`);
      }
    } catch (err) {
      alert(`Failed to export evidence: ${err.message}`);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="breadcrumbs">Home / Advanced Intelligence Search</div>
      <div className="page-header">
        <div>
          <h1>AI Detection & ANPR Search</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Search historical vehicle plate captures, vehicle attributes, and detection intelligence.
          </p>
        </div>
      </div>

      {/* Advanced Search Form */}
      <div className="panel">
        <div className="panel-header">
          <h2>Query Parameters</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            performSearch(0);
          }}
          className="panel-body"
        >
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="form-group">
              <label>License Plate Number</label>
              <input
                type="text"
                placeholder="e.g. GJ01AB1234"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Vehicle Type</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="">All Vehicle Types</option>
                <option value="SUV">SUV</option>
                <option value="SEDAN">Sedan</option>
                <option value="HATCHBACK">Hatchback</option>
                <option value="BUS">Bus (GSRTC/Private)</option>
                <option value="TRUCK">Heavy Truck / Trailer</option>
                <option value="MOTORCYCLE">Two-Wheeler / Bike</option>
                <option value="AUTO">Auto Rickshaw</option>
              </select>
            </div>
            <div className="form-group">
              <label>Vehicle Color</label>
              <select value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)}>
                <option value="">All Colors</option>
                <option value="WHITE">White</option>
                <option value="BLACK">Black</option>
                <option value="SILVER">Silver / Grey</option>
                <option value="RED">Red</option>
                <option value="BLUE">Blue</option>
                <option value="YELLOW">Yellow</option>
              </select>
            </div>
            <div className="form-group">
              <label>City Scope</label>
              <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">All Authorized Cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Min AI Confidence: {Math.round(minConfidence * 100)}%</label>
              <input
                type="range"
                min="0.3"
                max="0.99"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '7px 16px' }}>
                Execute Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search Results Table */}
      <div className="panel">
        <div className="panel-header">
          <h2>Search Results ({total} Matches)</h2>
        </div>
        <div className="data-table-wrapper">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Detection Time</th>
                <th>Plate Number</th>
                <th>Camera & Location</th>
                <th>City</th>
                <th>Dept</th>
                <th>Vehicle Attributes</th>
                <th>Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                    {loading ? 'Executing search query...' : 'No detection events found matching the specified parameters.'}
                  </td>
                </tr>
              ) : (
                results.map((det) => (
                  <tr key={det.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      {new Date(det.detectedAt).toLocaleString()}
                    </td>
                    <td>
                      <strong className="mono" style={{ fontSize: '13px', color: 'var(--gov-navy-900)' }}>
                        {det.plateNumber || '—'}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{det.cameraName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{det.cameraLocation}</div>
                    </td>
                    <td>{det.cityName}</td>
                    <td>{det.departmentCode}</td>
                    <td>
                      {det.vehicleColor && det.vehicleType ? (
                        <span style={{ fontWeight: 500 }}>{det.vehicleColor} {det.vehicleType}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge badge-active">
                        {Math.round(det.confidence * 100)}%
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleExportEvidence(det)}
                      >
                        Save Evidence
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination-bar">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => performSearch(page - 1)}
              >
                &larr; Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => performSearch(page + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
