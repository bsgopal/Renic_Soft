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

import ErrorBoundary from './components/ErrorBoundary.jsx';

const Protected = ({ children }) => {
  const { user } = useAuth() || {};
  if (!user) return <Navigate to="/login" replace />;
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
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/licenses" element={<Protected><Licenses /></Protected>} />
            <Route path="/plan-tiers" element={<Protected><PlanTiers /></Protected>} />
            <Route path="/applications" element={<Protected><ApplicationHub /></Protected>} />
            <Route path="/deployments" element={<Protected><AppDeployments /></Protected>} />
            <Route path="/credentials" element={<Protected><ApiCredentialsHub /></Protected>} />
            <Route path="/activity-report" element={<Protected><CustomerActivityReport /></Protected>} />
            <Route path="/network" element={<Protected><NetworkManager /></Protected>} />
            <Route path="/quotes" element={<Protected><Quotes /></Protected>} />
            <Route path="/quotes/:id" element={<Protected><QuoteView /></Protected>} />
            <Route path="/billing" element={<Protected><Billing /></Protected>} />
            <Route path="/billing/:id" element={<Protected><InvoiceView /></Protected>} />
            <Route path="/reports" element={<Protected><Reports /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </SnackbarProvider>
  </ErrorBoundary>
  );
}