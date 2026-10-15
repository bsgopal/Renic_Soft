import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import logo from '../assets/logo.png';

export default function Login() {
  const [tab, setTab] = useState(0); // 0=Sign In, 1=Forgot Password
  const navigate = useNavigate();
  const { login = () => {} } = useAuth() || {};
  const { showSnackbar = () => {} } = useSnackbar() || {};

  // Sign In state
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot Password state
  const [fpMobile, setFpMobile] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpStep, setFpStep] = useState(0);
  const [fpMessage, setFpMessage] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!mobile.trim() || !password) {
      setLoginError('Please enter both mobile number and password');
      return;
    }
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await api.post('/auth/login', { mobile, password });
      localStorage.setItem('renic_token', res.data.token);
      login(res.data.user, res.data.client || null);
      showSnackbar(`Welcome back, ${res.data.user.name?.split(' ')[0] || 'User'}!`, 'success');
      navigate('/');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleFpRequestOtp = async (e) => {
    e.preventDefault();
    if (!fpMobile.trim()) return;
    setFpError('');
    setFpLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { mobile: fpMobile });
      setFpMessage(res.data.message || 'OTP sent to registered contact.');
      setFpStep(1);
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleFpReset = async (e) => {
    e.preventDefault();
    if (!fpOtp.trim() || !fpNewPassword) return;
    setFpError('');
    setFpLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { mobile: fpMobile, otp: fpOtp, newPassword: fpNewPassword });
      setFpMessage(res.data.message || 'Password reset successfully. You can now sign in.');
      setFpStep(2);
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#0f172a] font-sans">
      
      {/* ── LEFT PANE: Company Overview & Brand Showcase ── */}
      <div className="w-full md:w-[48%] lg:w-[45%] bg-gradient-to-br from-[#0b1329] via-[#0f172a] to-[#1e293b] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#1e293b]">
        
        {/* Top Header & Brand */}
        <div>
          <div className="flex items-center gap-3.5 mb-6">
            <div className="bg-white p-2.5 rounded-2xl shadow-xl inline-flex items-center justify-center">
              <img
                src={logo}
                alt="Renic Soft Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  RENIC TECHNOLOGY
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black bg-[#84cc16] text-[#0f172a] rounded-md tracking-wider">
                  TECH
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold tracking-widest mt-0.5">
                IDEAS | SOLUTIONS | GROWTH
              </p>
            </div>
          </div>

          <div className="my-6 lg:my-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-3">
              Enterprise SaaS Management <br />
              <span className="text-[#84cc16]">&amp; Master Billing HQ</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              Centralized platform fleet administration, tenant licensing, multi-channel invoice dispatch, and high-security role orchestration.
            </p>
          </div>

          {/* Highlights */}
          <div className="space-y-4 my-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#84cc16]/15 text-[#84cc16] mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">Multi-Tenant Platform Fleet</h4>
                <p className="text-xs text-slate-400 mt-0.5">Unified control over TextilePOS, Delivery Challan &amp; WhatsApp CRM tenants.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#84cc16]/15 text-[#84cc16] mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">256-Bit Encrypted License Activation</h4>
                <p className="text-xs text-slate-400 mt-0.5">Automated JWT security key generation with instant SMS &amp; Email 2FA tokens.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#84cc16]/15 text-[#84cc16] mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">GST Billing &amp; Automated Quotations</h4>
                <p className="text-xs text-slate-400 mt-0.5">Dual-signatory print engines with customizable tax breakdowns &amp; bank QR codes.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Company Details */}
        <div className="pt-6 border-t border-white/10 mt-6">
          <div className="space-y-1.5 text-xs text-slate-400 mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#84cc16] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>123, Main Road, Gobichettipalayam, Erode - 638452, TN, India</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#84cc16] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>info@renictechnology.com · +91 88070 25752</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#84cc16] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span>www.renictechnology.com · GSTIN: 33AAAAA0000A1Z5</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} Renic Technology. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANE: Clean Login Card Area ── */}
      <div className="w-full md:w-[52%] lg:w-[55%] bg-[#f8fafc] flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/80 p-6 sm:p-8">
          
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Master Admin Portal
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <svg className="w-3 h-3 text-emerald-600 fill-current" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Authenticate using your master administrative credentials.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
            <div className="flex space-x-6">
              <button
                type="button"
                onClick={() => setTab(0)}
                className={`pb-2 text-sm font-bold transition-all relative ${
                  tab === 0 ? 'text-[#0f172a]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Sign In
                {tab === 0 && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-[3px] bg-[#84cc16] rounded-t-sm" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab(1)}
                className={`pb-2 text-sm font-bold transition-all relative ${
                  tab === 1 ? 'text-[#0f172a]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Forgot Password
                {tab === 1 && (
                  <span className="absolute bottom-[-13px] left-0 right-0 h-[3px] bg-[#84cc16] rounded-t-sm" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{loginError}</span>
            </div>
          )}

          {/* Tab 0: Sign In */}
          {tab === 0 && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    disabled={loginLoading}
                    placeholder="Enter registered mobile number"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#84cc16] focus:border-transparent text-slate-800 text-sm font-medium transition-all bg-slate-50/50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loginLoading}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#84cc16] focus:border-transparent text-slate-800 text-sm font-medium transition-all bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3.5 px-4 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-extrabold text-sm rounded-xl shadow-lg shadow-[#84cc16]/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {loginLoading ? (
                    <svg className="animate-spin h-5 w-5 text-[#0f172a]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                  ) : (
                    'Sign In to Master HQ'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Tab 1: Forgot Password */}
          {tab === 1 && (
            <div>
              {fpMessage && (
                <div className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  fpStep === 2 ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-sky-50 border border-sky-200 text-sky-800'
                }`}>
                  <span>{fpMessage}</span>
                </div>
              )}
              {fpError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                  <span>{fpError}</span>
                </div>
              )}

              {fpStep === 0 && (
                <form onSubmit={handleFpRequestOtp} className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium">
                    Enter your registered mobile number to receive a recovery code.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={fpMobile}
                      onChange={(e) => setFpMobile(e.target.value)}
                      required
                      disabled={fpLoading}
                      placeholder="e.g. 9345578103"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#84cc16] text-slate-800 text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full py-3 px-4 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-extrabold text-sm rounded-xl transition-all shadow-md"
                  >
                    {fpLoading ? 'Sending...' : 'Send Reset OTP'}
                  </button>
                </form>
              )}

              {fpStep === 1 && (
                <form onSubmit={handleFpReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                      OTP Code
                    </label>
                    <input
                      type="text"
                      value={fpOtp}
                      onChange={(e) => setFpOtp(e.target.value)}
                      required
                      disabled={fpLoading}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#84cc16] text-slate-800 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={fpNewPassword}
                      onChange={(e) => setFpNewPassword(e.target.value)}
                      required
                      disabled={fpLoading}
                      placeholder="Configure new password"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#84cc16] text-slate-800 text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full py-3 px-4 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-extrabold text-sm rounded-xl transition-all shadow-md"
                  >
                    {fpLoading ? 'Updating...' : 'Confirm New Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFpStep(0)}
                    disabled={fpLoading}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Back
                  </button>
                </form>
              )}

              {fpStep === 2 && (
                <div className="text-center py-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => { setTab(0); setFpStep(0); setFpMobile(''); setFpOtp(''); setFpNewPassword(''); setFpMessage(''); }}
                    className="py-2.5 px-6 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-extrabold text-sm rounded-xl transition-all shadow-md"
                  >
                    Proceed to Sign In
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Card Footer */}
          <div className="mt-6 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Protected by Renic Soft Enterprise Shield · 256-Bit TLS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
