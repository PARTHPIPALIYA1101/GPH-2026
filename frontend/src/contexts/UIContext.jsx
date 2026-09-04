import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const UIContext = createContext();

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  }, []);

  const showModal = useCallback(({ title, message, onConfirm, confirmText = 'Confirm', type = 'info' }) => {
    setModal({ title, message, onConfirm, confirmText, type });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <UIContext.Provider value={{ showToast, showModal }}>
      {children}
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((toast) => {
          const isDanger = toast.type === 'danger' || toast.type === 'error';
          const isSuccess = toast.type === 'success';
          return (
            <div key={toast.id} className={`toast toast-${isDanger ? 'danger' : isSuccess ? 'success' : 'info'}`}>
              <div className="toast-content">
                {isSuccess && <CheckCircle size={16} className="toast-icon toast-icon-success" />}
                {isDanger && <AlertTriangle size={16} className="toast-icon toast-icon-danger" />}
                {!isSuccess && !isDanger && <Info size={16} className="toast-icon toast-icon-info" />}
                <span>{toast.message}</span>
              </div>
              <button onClick={() => removeToast(toast.id)} className="toast-close"><X size={14} /></button>
            </div>
          );
        })}
      </div>

      {/* Modal Container */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal} style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div 
            className="modal-content system-modal system-modal-dark" 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '450px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}
          >
            <div 
              className={`modal-header ${modal.type === 'danger' ? 'modal-header-danger' : ''}`}
              style={{
                padding: '16px 20px',
                background: '#0F172A',
                borderBottom: `2px solid ${modal.type === 'danger' ? '#C9362B' : '#E58A24'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.04em' }}>{modal.title}</h3>
              <button className="modal-close" onClick={closeModal} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px', fontSize: '14px', background: '#1E293B', color: '#CBD5E1', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>{modal.message}</p>
            </div>
            <div className="modal-footer" style={{ padding: '16px 20px', background: '#0F172A', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={closeModal}
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#334155',
                  border: '1px solid #475569',
                  color: '#F8FAFC',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className={`btn ${modal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={() => {
                  modal.onConfirm();
                  closeModal();
                }}
                style={{
                  padding: '8px 20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: modal.type === 'danger' ? '#C9362B' : '#E58A24',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
