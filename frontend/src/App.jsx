import React, { useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { CamerasPage } from './pages/Cameras.jsx';
import { MapPage } from './pages/MapPage.jsx';
import { LivePage } from './pages/LivePage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { WatchlistsPage } from './pages/WatchlistsPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { InvestigationsPage } from './pages/InvestigationsPage.jsx';
import { EvidencePage } from './pages/EvidencePage.jsx';
import { AccessRequestsPage } from './pages/AccessRequestsPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { AuditPage } from './pages/AuditPage.jsx';
import { AdministrationPage } from './pages/AdministrationPage.jsx';

export default function App() {
  const { user, loading, logout, isStateAdmin, isDeptHead } = useAuth();
  const [selectedLiveCamera, setSelectedLiveCamera] = useState(null);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a192f',
        color: '#ffffff',
        fontSize: '14px'
      }}>
        Initializing Gujarat Government Video Intelligence Platform...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  function handleOpenLiveStream(camera) {
    setSelectedLiveCamera(camera);
    navigate('/live');
  }

  const navigationItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Cameras', path: '/cameras' },
    { label: 'GIS Map', path: '/map' },
    { label: 'Live Matrix', path: '/live' },
    { label: 'Search', path: '/search' },
    { label: 'Watchlists', path: '/watchlists' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Investigations', path: '/investigations' },
    { label: 'Evidence Locker', path: '/evidence' },
    { label: 'Access Sharing', path: '/access-requests' },
    { label: 'Reports', path: '/reports' },
    ...((isStateAdmin || isDeptHead) ? [{ label: 'Audit Trail', path: '/audit' }] : []),
    ...((isStateAdmin || isDeptHead) ? [{ label: 'Administration', path: '/administration' }] : [])
  ];

  return (
    <div className="app-shell">
      {/* Official State Header */}
      <header className="gov-header">
        <div className="gov-branding">
          <div className="gov-emblem" aria-label="Gujarat State Emblem">GJ</div>
          <div className="gov-title-block">
            <div className="state-title">GOVERNMENT OF GUJARAT</div>
            <div className="portal-title">Centralized Video Intelligence & Surveillance Platform</div>
          </div>
        </div>

        <div className="gov-header-right">
          <div className="user-profile-badge">
            <span className="user-name">{user.displayName}</span>
            <span className="user-dept">
              {user.departmentCode ? `${user.departmentCode} • ` : 'Statewide • '}
              {user.roles?.join(', ')}
            </span>
          </div>

          <span className="env-tag">DEVELOPMENT</span>

          <button className="btn-signout" onClick={logout} title="Sign out of current session">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Administrative Layout */}
      <div className="app-body">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div>Scope: <strong>{user.cities?.length ? user.cities.join(', ') : 'Statewide (All)'}</strong></div>
            <div style={{ fontSize: '10.5px', marginTop: 3 }}>Gov Gujarat Control Room Portal</div>
          </div>
        </aside>

        {/* Dynamic Route Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cameras" element={<CamerasPage onOpenLiveStream={handleOpenLiveStream} />} />
            <Route path="/map" element={<MapPage onOpenLiveStream={handleOpenLiveStream} />} />
            <Route path="/live" element={<LivePage selectedCamera={selectedLiveCamera} />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlists" element={<WatchlistsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/investigations" element={<InvestigationsPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/access-requests" element={<AccessRequestsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            {(isStateAdmin || isDeptHead) && <Route path="/audit" element={<AuditPage />} />}
            {(isStateAdmin || isDeptHead) && <Route path="/administration" element={<AdministrationPage />} />}
          </Routes>
        </main>
      </div>
    </div>
  );
}
