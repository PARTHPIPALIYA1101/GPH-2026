import React from 'react';
import { LiveMatrix } from '../live/LiveMatrix.jsx';

export function LivePage({ selectedCamera }) {
  return (
    <div>
      <div className="breadcrumbs">Home / Live Matrix Operations</div>
      <div className="page-header">
        <div>
          <h1>Live Surveillance Video Matrix</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Simultaneous multi-camera live video viewing supporting WebRTC/WHEP AI-annotated output and direct RTSP feeds.
          </p>
        </div>
      </div>
      <LiveMatrix initialCamera={selectedCamera} />
    </div>
  );
}
