import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './icons.jsx';
import api from '../api.js';
import logo from '../assets/logo.png';

const NAV_MODULES = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', short: 'Dash', end: true },
  { to: '/licenses', icon: 'license', label: 'Licenses & Fleet', short: 'Licenses' },
  { to: '/plan-tiers', icon: 'license', label: 'Plan Tiers & Screens', short: 'Plans' },
  { to: '/applications', icon: 'store', label: 'Applications (PaaS)', short: 'Apps' },
  { to: '/deployments', icon: 'gitBranch', label: 'Deployments', short: 'Deploy' },
  { to: '/credentials', icon: 'key', label: 'API & OAuth Hub', short: 'API Hub' },
  { to: '/activity-report', icon: 'eye', label: 'Screen Audit', short: 'Audit' },
  { to: '/network', icon: 'network', label: 'Customer URLs', short: 'Network' },
  { to: '/quotes', icon: 'quote', label: 'Quotations', short: 'Quotes' },
  { to: '/billing', icon: 'bill', label: 'Billing', short: 'Billing' },
  { to: '/reports', icon: 'bill', label: 'Payment Reports', short: 'Reports' },
  { to: '/notifications', icon: 'bell', label: 'Notifications', short: 'Notifs' },
  { to: '/settings', icon: 'store', label: 'Company Settings', short: 'Settings' }
];

const severityDot = {
  critical: 'bg-rose-600 animate-pulse',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500'
};

export default function Layout({ children }) {
  const { user = null, logout = () => {} } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  // Left sidebar starts expanded by default
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [notifs, setNotifs] = useState({ notifications: [], unreadCount: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [copiedTunnel, setCopiedTunnel] = useState(false);
  const bellRef = useRef(null);

  const getReadNotifIds = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem('renic_soft_read_notifs') || '[]'));
    } catch {
      return new Set();
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get('/notifications');
      const readIds = getReadNotifIds();
      const rawList = res.data?.notifications || [];
      const enriched = rawList.map((n, idx) => ({
        ...n,
        id: n.entityId ? String(n.entityId) : `${n.type}-${n.title}-${idx}`
      }));
      const unreadCount = enriched.filter((n) => !readIds.has(n.id)).length;
      setNotifs({ ...res.data, notifications: enriched, unreadCount });
    } catch {
      /* silent */
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    try {
      const readIds = getReadNotifIds();
      (notifs.notifications || []).forEach((n) => {
        if (n.id) readIds.add(n.id);
      });
      localStorage.setItem('renic_soft_read_notifs', JSON.stringify(Array.from(readIds).slice(-200)));
      setNotifs((prev) => ({ ...prev, unreadCount: 0 }));
    } catch {
      /* silent */
    }
  }, [notifs.notifications]);

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 8000);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const unread = notifs.unreadCount || 0;

  // Check if current page is full-height 2-column workspace
  const isFullHeightPage = ['/licenses', '/quotes', '/billing', '/applications', '/network', '/credentials'].some(
    p => location.pathname.startsWith(p)
  );

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#f4f6f8] text-slate-800 antialiased overflow-hidden">
      {/* ── 1. MAIN TOP HEADER (UNIFIED OBSIDIAN BLACK THEME) ── */}
      <header className="bg-[#0f172a] border-b border-slate-800 text-white sticky top-0 z-40 h-13 flex-shrink-0 px-3 sm:px-4 flex items-center justify-between shadow-md">
        {/* Left: Sidebar Toggle + Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title={sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-white rounded-lg p-1 flex items-center justify-center shadow-xs">
              <img src={logo} alt="Renic Soft" className="w-6 h-6 object-contain" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-sm tracking-tight">Renic Soft</span>
              <span className="text-[10px] bg-[#84cc16] text-[#0f172a] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">TECH</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded font-bold border border-slate-700 hidden sm:inline-block">Master HQ</span>
            </div>
          </div>
        </div>

        {/* Right: Tunnel Status, Notifications, Profile */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Cloudflare Tunnel Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-full text-[11px] text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-400">Platform Live</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText('https://renictech.com');
                setCopiedTunnel(true);
                setTimeout(() => setCopiedTunnel(false), 2000);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded transition flex items-center ml-0.5"
              title="Copy Tunnel URL"
            >
              <Icon name={copiedTunnel ? 'check' : 'copy'} className="w-3 h-3 text-emerald-400" />
            </button>
          </div>

          {/* Notifications Bell */}
          <div className="relative" ref={bellRef}>
            <button
              className="relative p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
              onClick={() => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next) markAllAsRead();
              }}
              title="Notifications"
            >
              <Icon name="bell" className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-10 w-[360px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-800">
                <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-100 bg-slate-50">
                  <h4 className="font-bold text-slate-900 text-xs">Notifications</h4>
                  <button className="text-[11px] text-[#65a30d] font-semibold hover:underline" onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>
                    View all
                  </button>
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                  {notifs.notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">No new alerts</div>
                  ) : (
                    notifs.notifications.slice(0, 10).map((n, i) => (
                      <button
                        key={i}
                        className="w-full text-left p-3 hover:bg-slate-50 flex items-start gap-2.5 transition text-xs"
                        onClick={() => { setNotifOpen(false); if (n.link) navigate(n.link); }}
                      >
                        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${severityDot[n.severity] || 'bg-sky-500'}`} />
                        <div className="min-w-0 flex-1">
                          <span className="block font-bold text-slate-900 text-xs">{n.title}</span>
                          <span className="block text-slate-500 text-[11px] truncate mt-0.5">{n.message}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-[#84cc16] ring-1 ring-slate-700 flex items-center justify-center text-xs font-bold font-mono">
              {initials}
            </div>
            <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-rose-400 rounded transition" title="Logout">
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. SUB-HEADER MODULE SCREEN TABS (OBSIDIAN DARK BACKGROUND) ── */}
      <div className="bg-[#1e293b] border-b border-slate-800 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 z-30">
        <div className="flex items-center gap-1.5 min-w-max">
          {NAV_MODULES.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#84cc16] text-[#0f172a] shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <Icon name={m.icon} className="w-3.5 h-3.5" />
              <span>{m.short}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── 3. BODY CONTAINER: LEFT COLLAPSIBLE SIDEBAR + MAIN WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR (Obsidian Theme, Default: Expanded, Hover Tooltips on Collapse) */}
        <aside
          className={`bg-[#0f172a] border-r border-slate-800 flex flex-col flex-shrink-0 transition-all duration-200 z-30 ${
            sidebarExpanded ? 'w-56' : 'w-14'
          }`}
        >
          <div className="flex-1 py-2 px-1.5 space-y-1 overflow-y-auto">
            {NAV_MODULES.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition group relative ${
                    isActive
                      ? 'bg-[#84cc16] text-[#0f172a] shadow-xs'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
                title={m.label}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <Icon name={m.icon} className="w-4 h-4" />
                </div>
                {sidebarExpanded && (
                  <span className="truncate">{m.label}</span>
                )}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#020617] text-white text-xs font-bold rounded-lg shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap border border-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#84cc16]" />
                    <span>{m.label}</span>
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#020617]" />
                  </div>
                )}
              </NavLink>
            ))}
          </div>

          {/* Bottom Sidebar Collapse / Expand Button */}
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white text-xs font-bold transition"
              title={sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Icon name="expand" className={`w-4 h-4 transition-transform ${sidebarExpanded ? 'rotate-180' : ''}`} />
              {sidebarExpanded && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* MAIN WORKSPACE (Takes 100% Remaining Screen Real Estate) */}
        <main className={`flex-1 min-w-0 overflow-hidden flex flex-col ${isFullHeightPage ? 'p-0' : 'overflow-y-auto p-4 sm:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
