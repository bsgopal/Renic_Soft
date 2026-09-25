import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './icons.jsx';
import api from '../api.js';
import logo from '../assets/logo.png';

const NavItem = ({ to, icon, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 font-semibold'
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`
    }
  >
    <Icon name={icon} className="w-5 h-5" />
    {label}
  </NavLink>
);

const severityDot = {
  critical: 'bg-rose-600 animate-pulse',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500'
};

export default function Layout({ children }) {
  const { user = null, logout = () => {} } = useAuth() || {};
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    const t = setInterval(loadNotifications, 60000); // refresh every minute
    return () => clearInterval(t);
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 md:px-6 h-16">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-full hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Icon name="menu" className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="Renic Soft" className="w-9 h-9 rounded-xl object-contain bg-white ring-1 ring-gray-100" />
              <div>
                <div className="font-semibold text-ink leading-tight">Renic Soft</div>
                <div className="text-xs text-gray-500 -mt-0.5">License · Quotation · Billing</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Cloudflare Tunnel Status Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/80 px-3 py-1.5 rounded-full text-xs shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-emerald-900 tracking-tight">Tunnel: Active</span>
              <span className="text-emerald-700 font-mono text-[11px] truncate max-w-[140px] hidden md:inline bg-emerald-100/60 px-1.5 py-0.5 rounded">
                trycloudflare.com
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://today-anticipated-earning-centres.trycloudflare.com');
                  setCopiedTunnel(true);
                  setTimeout(() => setCopiedTunnel(false), 2000);
                }}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md hover:bg-emerald-200/60 transition-colors flex items-center gap-1"
                title="Copy Cloudflare Tunnel Public Gateway URL"
              >
                <Icon name={copiedTunnel ? 'check' : 'copy'} className="w-3.5 h-3.5 text-emerald-700" />
                {copiedTunnel && <span className="text-[10px] font-bold text-emerald-800">Copied!</span>}
              </button>
            </div>

            {/* Notifications bell */}
            <div className="relative" ref={bellRef}>
              <button
                className="relative p-2.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                onClick={() => {
                  const nextState = !notifOpen;
                  setNotifOpen(nextState);
                  if (nextState) {
                    markAllAsRead();
                  }
                }}
                title="Notifications"
              >
                <Icon name="bell" className="w-5 h-5" />
                {unread > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${(notifs.notifications || []).some(n => n.severity === 'critical') ? 'bg-rose-600 ring-2 ring-rose-300 animate-pulse' : 'bg-red-500'}`}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-[380px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-ink text-sm">Notifications</h4>
                      {(notifs.notifications || []).some(n => n.severity === 'critical') && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                          CRITICAL ALERT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-xs text-slate-500 hover:text-slate-800"
                        onClick={markAllAsRead}
                      >
                        Clear badge
                      </button>
                      <button
                        className="text-xs text-brand-600 font-medium hover:underline"
                        onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                      >
                        View all
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                    {loadingNotifs && notifs.notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : notifs.notifications.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2">
                          <Icon name="check" className="w-5 h-5" />
                        </div>
                        <p className="text-sm text-gray-500">You're all caught up!</p>
                      </div>
                    ) : (
                      notifs.notifications.slice(0, 15).map((n, i) => (
                        <button
                          key={i}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 transition-colors ${n.severity === 'critical' ? 'bg-rose-50/50 hover:bg-rose-50 border-l-4 border-l-rose-600' : ''}`}
                          onClick={() => { setNotifOpen(false); if (n.link) navigate(n.link); }}
                        >
                          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${severityDot[n.severity] || 'bg-sky-500'}`} />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-xs font-semibold leading-snug ${n.severity === 'critical' ? 'text-rose-900 font-bold' : 'text-ink'}`}>{n.title}</span>
                            <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</span>
                            {n.timestamp && (
                              <span className="block text-[10px] text-gray-400 mt-1">
                                {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.timestamp).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium leading-tight">{user?.name}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
              <button onClick={handleLogout} className="p-2.5 rounded-full hover:bg-gray-100 text-gray-600" title="Logout">
                <Icon name="logout" className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-1 z-40 transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Menu</div>
          <NavItem to="/" icon="dashboard" label="Dashboard" end />
          <NavItem to="/licenses" icon="license" label="Licenses & Fleet" />
          <NavItem to="/applications" icon="store" label="Applications (PaaS Hub)" />
          <NavItem to="/deployments" icon="gitBranch" label="Git Deployments" />
          <NavItem to="/credentials" icon="key" label="API & OAuth Hub" />
          <NavItem to="/activity-report" icon="eye" label="Customer Screen Audit" />
          <NavItem to="/network" icon="network" label="Port Forwarding & Router" />
          <NavItem to="/quotes" icon="quote" label="Quotations" />
          <NavItem to="/billing" icon="bill" label="Billing" />
          <NavItem to="/reports" icon="bill" label="Payment Reports" />

          <div className="px-2 pt-2 mt-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100">System</div>
          <NavItem to="/notifications" icon="bell" label="Notifications" />
          <NavItem to="/settings" icon="store" label="Company Settings" />

          <div className="flex-1" />

          {unread > 0 && (
            <button
              className="mb-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
              onClick={() => navigate('/notifications')}
            >
              <div className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                <Icon name="bell" className="w-4 h-4" /> {unread} action{unread > 1 ? 's' : ''} needed
              </div>
              <div className="text-xs text-amber-600 mt-0.5">Expiring licenses & pending payments</div>
            </button>
          )}

          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
            <div className="font-medium text-sm mb-1">Renic Soft Platform</div>
            <p className="text-xs opacity-80 leading-relaxed">Manage licenses, quotations & invoices from one place.</p>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}