import React from 'react';
import { CameraMap } from '../map/CameraMap.jsx';

export function MapPage({ onOpenLiveStream }) {
  return (
    <div>
      <div className="breadcrumbs">Home / Gujarat GIS Map</div>
      <div className="page-header">
        <div>
          <h1>Gujarat GIS Camera Surveillance Map</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '12.5px', marginTop: 2 }}>
            Interactive geographical map of authorized state surveillance cameras with server-side clustering.
          </p>
        </div>
      </div>
      <CameraMap onSelectCameraForLive={onOpenLiveStream} />
    </div>
  );
}
