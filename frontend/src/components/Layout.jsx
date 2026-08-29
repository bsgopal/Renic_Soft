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
      `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      }`
    }
  >
    <Icon name={icon} className="w-5 h-5" />
    {label}
  </NavLink>
);

const severityDot = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500'
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifs, setNotifs] = useState({ notifications: [], unreadCount: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const bellRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get('/notifications');
      setNotifs(res.data);
    } catch {
      /* silent */
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

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

          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <div className="relative" ref={bellRef}>
              <button
                className="relative p-2.5 rounded-full hover:bg-gray-100 text-gray-600"
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) loadNotifications(); }}
                title="Notifications"
              >
                <Icon name="bell" className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-[360px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                    <h4 className="font-semibold text-ink text-sm">Notifications</h4>
                    <button className="text-xs text-brand-600 font-medium hover:underline" onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>
                      View all
                    </button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
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
                      notifs.notifications.slice(0, 12).map((n, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                          onClick={() => { setNotifOpen(false); if (n.link) navigate(n.link); }}
                        >
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severityDot[n.severity] || 'bg-sky-500'}`} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink leading-snug">{n.title}</span>
                            <span className="block text-xs text-gray-500 mt-0.5 truncate">{n.message}</span>
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
          <NavItem to="/licenses" icon="license" label="Licenses" />
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