import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Icon } from '../components/icons.jsx';

// Safe default context to prevent "Cannot destructure property 'showSnackbar' of 'useSnackbar(...)' as it is null"
const defaultSnackbarContext = {
  showSnackbar: (message, type = 'success') => {
    if (typeof console !== 'undefined') console.log(`[Snackbar ${type}]:`, message);
  },
  confirmDialog: async ({ title = 'Are you sure?', message = '', confirmText = 'Confirm' } = {}) => {
    if (typeof window !== 'undefined') {
      return window.confirm(`${title}\n\n${message}`);
    }
    return Promise.resolve(true);
  }
};

const SnackbarContext = createContext(defaultSnackbarContext);

export const SnackbarProvider = ({ children }) => {
  const [snack, setSnack] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const timerRef = useRef(null);
  const confirmResolve = useRef(null);

  const showSnackbar = useCallback((message, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSnack({ message, type });
    timerRef.current = setTimeout(() => setSnack(null), 4000);
  }, []);

  const confirmDialog = useCallback(({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      confirmResolve.current = resolve;
      setConfirm({ title, message, confirmText, danger });
    });
  }, []);

  const handleConfirm = (value) => {
    setConfirm(null);
    if (confirmResolve.current) confirmResolve.current(value);
    confirmResolve.current = null;
  };

  const snackStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-sky-600 text-white',
    warning: 'bg-amber-500 text-white'
  };

  const snackIcons = { success: 'check', error: 'x', info: 'bell', warning: 'clock' };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, confirmDialog }}>
      {children}

      {/* Snackbar */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 ${
          snack ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {snack && (
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl min-w-[300px] max-w-[90vw] ${snackStyles[snack.type]}`}>
            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 shrink-0">
              <Icon name={snackIcons[snack.type]} className="w-4 h-4" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-medium">{snack.message}</span>
            <button className="ml-1 p-1 rounded-full hover:bg-white/20" onClick={() => setSnack(null)}>
              <Icon name="x" className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => handleConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirm.danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-500'}`}>
              <Icon name={confirm.danger ? 'trash' : 'bell'} className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-ink">{confirm.title}</h3>
            {confirm.message && <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{confirm.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => handleConfirm(false)}>Cancel</button>
              <button className={confirm.danger ? 'btn-danger' : 'btn-primary'} onClick={() => handleConfirm(true)}>
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const ctx = useContext(SnackbarContext);
  return ctx || defaultSnackbarContext;
};