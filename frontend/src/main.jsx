import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Enterprise Console Shield & Source Protection
if (import.meta.env.PROD || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
  try {
    const noop = () => {};
    window.console.log = noop;
    window.console.debug = noop;
    window.console.info = noop;
    window.console.dir = noop;
    window.console.trace = noop;
    window.console.warn(
      '%c[RENIC SECURITY NOTICE] Proprietary Software • All Rights Reserved.\nUnauthorized inspection, reverse-engineering, or tampering is strictly prohibited under international copyright law.',
      'color: #4f46e5; font-size: 13px; font-weight: bold;'
    );
  } catch (e) {}
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);