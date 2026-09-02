import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a192f',
      backgroundImage: 'radial-gradient(circle at top right, #1b3d60, #0a192f)',
      padding: 20
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: 460,
        borderRadius: 4,
        boxShadow: '0 12px 35px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        <div style={{
          backgroundColor: '#0f2942',
          padding: '24px 20px',
          color: '#ffffff',
          textAlign: 'center',
          borderBottom: '3px solid #d97706'
        }}>
          <div style={{
            width: 48,
            height: 48,
            background: '#d97706',
            color: '#0a192f',
            fontWeight: 800,
            fontSize: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            marginBottom: 10,
            border: '2px solid #ffffff'
          }}>
            GJ
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.6 }}>GOVERNMENT OF GUJARAT</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
            Centralized Video Intelligence & Surveillance Platform
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '8px 12px',
              borderRadius: 3,
              fontSize: 12,
              marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Government Email ID</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.gov.in"
            />
          </div>

          <div className="form-group">
            <label>Security Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '8px 14px', fontSize: 13, marginTop: 8 }}
          >
            {loading ? 'Authenticating Credentials...' : 'Sign In to Administrative Portal'}
          </button>

          {/* Development Quick Role Switcher */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
              Development Test Identities:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {devIdentities.map((ident) => (
                <button
                  type="button"
                  key={ident.email}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: 11 }}
                  onClick={() => {
                    setEmail(ident.email);
                    setPassword('GovDevOnly!2026');
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{ident.label}</span>
                </button>
              ))}
            </div>
          </div>
        </form>

        <div style={{
          backgroundColor: '#f8fafc',
          padding: '10px 16px',
          borderTop: '1px solid #e2e8f0',
          fontSize: 11,
          color: '#64748b',
          textAlign: 'center'
        }}>
          Government of Gujarat • Unauthorized access is strictly prohibited and audited under IT Act.
        </div>
      </div>
    </div>
  );
}
