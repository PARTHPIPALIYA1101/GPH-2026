import React, { useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Video, Map as MapIcon, Grid, Search, Eye, Bell, FolderKanban, ShieldAlert, Users, FileText, History, Settings, LogOut } from 'lucide-react';
import { useAuth } from './contexts/AuthContext.jsx';
import { useUI } from './contexts/UIContext.jsx';

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
  const { showModal } = useUI();
  const [selectedLiveCamera, setSelectedLiveCamera] = useState(null);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--structure-dark)',
        color: '#ffffff',
        fontSize: '14px',
        fontFamily: 'var(--font-mono)'
      }}>
        Initializing Sentinel Platform...
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

  function handleLogout() {
    showModal({
      title: 'End Session',
      message: 'Are you sure you want to log out of the Sentinel platform?',
      confirmText: 'Sign Out',
      type: 'danger',
      onConfirm: logout
    });
  }

  const navGroups = [
    {
      title: 'COMMAND',
      items: [
        { label: 'Overview', path: '/', icon: <LayoutDashboard className="icon" /> },
        { label: 'Live Operations', path: '/live', icon: <Grid className="icon" /> },
        { label: 'GIS Intelligence', path: '/map', icon: <MapIcon className="icon" /> },
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { label: 'ANPR Search', path: '/search', icon: <Search className="icon" /> },
        { label: 'Alerts', path: '/alerts', icon: <Bell className="icon" /> },
        { label: 'Watchlists', path: '/watchlists', icon: <Eye className="icon" /> },
        { label: 'Investigations', path: '/investigations', icon: <FolderKanban className="icon" /> },
        { label: 'Evidence Locker', path: '/evidence', icon: <ShieldAlert className="icon" /> },
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { label: 'Cameras', path: '/cameras', icon: <Video className="icon" /> },
        { label: 'Access Sharing', path: '/access-requests', icon: <Users className="icon" /> },
        { label: 'Reports', path: '/reports', icon: <FileText className="icon" /> },
        ...((isStateAdmin || isDeptHead) ? [{ label: 'Audit Trail', path: '/audit', icon: <History className="icon" /> }] : [])
      ]
    }
  ];

  if (isStateAdmin || isDeptHead) {
    navGroups.push({
      title: 'ADMINISTRATION',
      items: [
        { label: 'Users & Roles', path: '/administration', icon: <Settings className="icon" /> }
      ]
    });
  }

  return (
    <div className="app-shell">
      {/* Official State Header */}
      <header className="gov-header">
        <div className="gov-branding">
          <div className="gov-emblem" aria-label="Gujarat State Emblem">GJ</div>
          <div className="gov-title-block">
            <div className="state-title">SENTINEL • GUJARAT POLICE</div>
            <div className="portal-title">Video Intelligence & Surveillance Platform</div>
          </div>
        </div>

        <div className="gov-header-right">
          <div className="system-status">
            <div className="indicator"></div>
            SYSTEM OPERATIONAL
          </div>
          <div className="user-profile-badge">
            <span className="user-name">{user.displayName}</span>
            <span className="user-dept">
              {user.departmentCode ? `${user.departmentCode} • ` : 'Statewide • '}
              {user.roles?.join(', ')}
            </span>
          </div>

          <button className="btn btn-secondary" onClick={handleLogout} title="Sign out" style={{ padding: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Administrative Layout */}
      <div className="app-body">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {navGroups.map((group, i) => (
              <div key={i} className="nav-group">
                <div className="nav-group-title">{group.title}</div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div>Scope: <strong style={{ color: '#fff' }}>{user.cities?.length ? user.cities.join(', ') : 'Statewide (All)'}</strong></div>
            <button onClick={handleLogout}><LogOut size={14} /> Sign Out</button>
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
