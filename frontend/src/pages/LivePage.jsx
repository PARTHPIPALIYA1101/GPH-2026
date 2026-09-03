import React from 'react';
import { LiveMatrix } from '../live/LiveMatrix.jsx';
import { Radio, Grid } from 'lucide-react';

export function LivePage({ selectedCamera }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Operational Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 14, marginBottom: 0,
        borderBottom: '2px solid var(--brand-terracotta)', flexShrink: 0
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Radio size={13} style={{ color: 'var(--status-success)', animation: 'pulse 2s infinite' }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
              color: 'var(--status-success)', letterSpacing: '0.08em'
            }}>
              LIVE STREAMING
            </span>
          </div>
          <h1 style={{ fontSize: '24px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Grid size={20} style={{ color: 'var(--brand-terracotta)' }} />
            LIVE OPERATIONS MATRIX
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Multi-camera surveillance wall · Sentinel AI annotation · Real-time MJPEG streams
          </p>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          padding: '6px 14px', borderRadius: 2, letterSpacing: '0.04em'
        }}>
          GUJARAT POLICE · SENTINEL PLATFORM
        </div>
      </div>

      {/* ── Matrix fills remaining height ── */}
      <div style={{ flex: 1, paddingTop: 14, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <LiveMatrix initialCamera={selectedCamera} />
      </div>
    </div>
  );
}
