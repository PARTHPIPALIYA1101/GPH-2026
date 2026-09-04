import React from 'react';
import { X } from 'lucide-react';

export function Drawer({ isOpen, onClose, title, children, width = '400px' }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer" style={{ width }}>
        <div className="drawer-header">
          <h3>{title}</h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </>
  );
}
