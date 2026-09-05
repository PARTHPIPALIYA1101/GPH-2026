import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ShieldAlert, Lock, Mail, AlertCircle, ChevronRight, Loader } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('state.admin@example.gov.in');
  const [password, setPassword] = useState('GovDevOnly!2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const devIdentities = [
    { label: 'State Admin (Statewide)', email: 'state.admin@example.gov.in', dept: 'State Admin' },
    { label: 'Police Dept Head (Ahmedabad, Rajkot)', email: 'police.head@example.gov.in', dept: 'Police' },
    { label: 'Police Officer / Investigator', email: 'police.officer@example.gov.in', dept: 'Police' },
    { label: 'Police Control Operator', email: 'police.operator@example.gov.in', dept: 'Police' },
    { label: 'GSRTC Dept Head (All Hubs)', email: 'gsrtc.head@example.gov.in', dept: 'GSRTC' }
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* Left panel — branding */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-emblem">GJ</div>
          <div className="login-brand-title">SENTINEL</div>
          <div className="login-brand-sub">GUJARAT POLICE</div>
          <p className="login-brand-desc">
            Centralized Video Intelligence &amp; Surveillance Platform
          </p>
          <div className="login-brand-rule" />
          <div className="login-brand-tags">
            <span className="login-tag"><ShieldAlert size={12} /> SECURE ACCESS</span>
            <span className="login-tag">CLASSIFIED</span>
            <span className="login-tag">GOVERNMENT USE ONLY</span>
          </div>
        </div>

        <div className="login-brand-footer">
          Government of Gujarat &bull; Department of Home Affairs
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-form-panel">
        <div className="login-card">
          {/* Card header */}
          <div className="login-card-header">
            <div className="login-card-icon">
              <Lock size={18} />
            </div>
            <div>
              <div className="login-card-title">SYSTEM ACCESS</div>
              <div className="login-card-subtitle">Authorised Personnel Only</div>
            </div>
          </div>

          {/* Auth error */}
          {error && (
            <div className="login-error-banner">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">
                <Mail size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Government Email ID
              </label>
              <input
                id="login-email"
                type="email"
                required
                className="form-control login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.gov.in"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">
                <Lock size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Security Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                className="form-control login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader size={14} className="login-spinner" />
                  Authenticating Credentials...
                </>
              ) : (
                <>
                  Sign In to Administrative Portal
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Development Quick Role Switcher */}
          <div className="login-dev-section">
            <div className="login-dev-header">
              Development Test Identities
            </div>
            <div className="login-dev-list">
              {devIdentities.map((ident) => (
                <button
                  type="button"
                  key={ident.email}
                  className="btn btn-secondary btn-sm login-dev-btn"
                  disabled={loading}
                  onClick={() => {
                    setEmail(ident.email);
                    setPassword('GovDevOnly!2026');
                  }}
                >
                  <ChevronRight size={11} style={{ flexShrink: 0 }} />
                  <span className="login-dev-label">{ident.label}</span>
                  <span className="login-dev-dept">{ident.dept}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer notice */}
          <div className="login-card-footer">
            Unauthorized access is strictly prohibited and audited under the IT Act, 2000
          </div>
        </div>
      </div>
    </div>
  );
}
