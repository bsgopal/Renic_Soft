import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SnackbarProvider } from './context/SnackbarContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Licenses from './pages/Licenses.jsx';
import NetworkManager from './pages/NetworkManager.jsx';
import Quotes from './pages/Quotes.jsx';
import QuoteView from './pages/QuoteView.jsx';
import Billing from './pages/Billing.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Reports from './pages/Reports.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';
import ApiCredentialsHub from './pages/ApiCredentialsHub.jsx';
import CustomerActivityReport from './pages/CustomerActivityReport.jsx';
import AppDeployments from './pages/AppDeployments.jsx';
import ApplicationHub from './pages/ApplicationHub.jsx';
import PlanTiers from './pages/PlanTiers.jsx';
import Users from './pages/Users.jsx';

import ErrorBoundary from './components/ErrorBoundary.jsx';

const Protected = ({ children, path }) => {
  const { user, isSuperAdmin, canAccessPage } = useAuth() || {};
  if (!user) return <Navigate to="/login" replace />;

  if (path) {
    if (path === '/users' && !isSuperAdmin) {
      return (
        <ErrorBoundary>
          <Layout>
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 m-6 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-1">Super Admin Access Only</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                User Management and RBAC screen assignment is strictly restricted to the Super Admin (9345578103).
              </p>
            </div>
          </Layout>
        </ErrorBoundary>
      );
    }

    if (!canAccessPage(path)) {
      return (
        <ErrorBoundary>
          <Layout>
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 m-6 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-1">Screen Access Restricted</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                You do not have permission to view this module. Please contact the Super Admin (9345578103) to request access.
              </p>
            </div>
          </Layout>
        </ErrorBoundary>
      );
    }
  }

  return (
    <ErrorBoundary>
      <Layout>{children}</Layout>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SnackbarProvider>
        <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected path="/"><Dashboard /></Protected>} />
            <Route path="/licenses" element={<Protected path="/licenses"><Licenses /></Protected>} />
            <Route path="/plan-tiers" element={<Protected path="/plan-tiers"><PlanTiers /></Protected>} />
            <Route path="/applications" element={<Protected path="/applications"><ApplicationHub /></Protected>} />
            <Route path="/deployments" element={<Protected path="/deployments"><AppDeployments /></Protected>} />
            <Route path="/credentials" element={<Protected path="/credentials"><ApiCredentialsHub /></Protected>} />
            <Route path="/activity-report" element={<Protected path="/activity-report"><CustomerActivityReport /></Protected>} />
            <Route path="/network" element={<Protected path="/network"><NetworkManager /></Protected>} />
            <Route path="/quotes" element={<Protected path="/quotes"><Quotes /></Protected>} />
            <Route path="/quotes/:id" element={<Protected path="/quotes"><QuoteView /></Protected>} />
            <Route path="/billing" element={<Protected path="/billing"><Billing /></Protected>} />
            <Route path="/billing/:id" element={<Protected path="/billing"><InvoiceView /></Protected>} />
            <Route path="/reports" element={<Protected path="/reports"><Reports /></Protected>} />
            <Route path="/notifications" element={<Protected path="/notifications"><Notifications /></Protected>} />
            <Route path="/settings" element={<Protected path="/settings"><Settings /></Protected>} />
            <Route path="/users" element={<Protected path="/users"><Users /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </SnackbarProvider>
  </ErrorBoundary>
  );
}