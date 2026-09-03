import React, { createContext, useContext, useState, useCallback } from 'react';

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
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="toast-close">&times;</button>
          </div>
        ))}
      </div>

      {/* Modal Container */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content system-modal" onClick={e => e.stopPropagation()}>
            <div className={`modal-header ${modal.type === 'danger' ? 'modal-header-danger' : ''}`}>
              <h3>{modal.title}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <p>{modal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button 
                className={`btn ${modal.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={() => {
                  modal.onConfirm();
                  closeModal();
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
