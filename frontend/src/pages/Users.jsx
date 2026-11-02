import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import { Icon } from '../components/icons.jsx';
import api from '../api.js';

export default function Users() {
  const { user: currentUser, isSuperAdmin } = useAuth() || {};
  const { showSnackbar } = useSnackbar();

  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Segmentation: 'ALL' | 'INTERNAL_USERS' | 'EXTERNAL_CLIENTS'
  const [categoryTab, setCategoryTab] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [appFilter, setAppFilter] = useState('ALL');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [accountType, setAccountType] = useState('INTERNAL_USER'); // 'INTERNAL_USER' | 'EXTERNAL_CLIENT'
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    role: 'admin',
    allowedPages: [],
    assignedApplications: [],
    clientAppCode: '',
    isActive: true
  });
  const [saving, setSaving] = useState(false);

  // Quick Password Reset Modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data?.users || []);
      if (res.data?.modules) setModules(res.data.modules);
      if (res.data?.applications) setApplications(res.data.applications);
    } catch (err) {
      console.error('Fetch users error:', err);
      showSnackbar(err.response?.data?.message || 'Failed to load users list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = (type = 'INTERNAL_USER') => {
    setEditingUser(null);
    setAccountType(type);
    setFormData({
      name: '',
      mobile: '',
      email: '',
      password: '',
      role: type === 'EXTERNAL_CLIENT' ? 'client' : 'admin',
      allowedPages: type === 'EXTERNAL_CLIENT' ? ['/', '/quotes', '/billing'] : ['/', '/licenses', '/quotes', '/billing'],
      assignedApplications: type === 'INTERNAL_USER' && applications.length > 0 ? [applications[0].appCode] : [],
      clientAppCode: type === 'EXTERNAL_CLIENT' && applications.length > 0 ? applications[0].appCode : '',
      isActive: true
    });
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    const isClient = u.role === 'client' || u.role === 'client_admin';
    const type = isClient ? 'EXTERNAL_CLIENT' : 'INTERNAL_USER';
    setAccountType(type);
    setFormData({
      name: u.name || '',
      mobile: u.mobile || '',
      email: u.email || '',
      password: '',
      role: u.role === 'platform_owner' || u.role === 'super_admin' ? 'platform_owner' : (u.role || 'admin'),
      allowedPages: u.allowedPages || [],
      assignedApplications: u.assignedApplications || [],
      clientAppCode: u.clientAppCode || '',
      isActive: u.isActive !== false
    });
    setModalOpen(true);
  };

  const openPasswordModal = (u) => {
    setPwdUser(u);
    setNewPassword('');
    setPwdModalOpen(true);
  };

  const handleTogglePage = (path) => {
    setFormData((prev) => {
      const exists = prev.allowedPages.includes(path);
      const nextPages = exists
        ? prev.allowedPages.filter((p) => p !== path)
        : [...prev.allowedPages, path];
      return { ...prev, allowedPages: nextPages };
    });
  };

  const handleToggleApplication = (appCode) => {
    setFormData((prev) => {
      const exists = prev.assignedApplications.includes(appCode);
      const nextApps = exists
        ? prev.assignedApplications.filter((c) => c !== appCode)
        : [...prev.assignedApplications, appCode];
      return { ...prev, assignedApplications: nextApps };
    });
  };

  const handleSelectAllPages = () => {
    setFormData((prev) => ({
      ...prev,
      allowedPages: modules.map((m) => m.path)
    }));
  };

  const handleClearAllPages = () => {
    setFormData((prev) => ({
      ...prev,
      allowedPages: []
    }));
  };

  const handleSelectAllApps = () => {
    setFormData((prev) => ({
      ...prev,
      assignedApplications: applications.map((a) => a.appCode)
    }));
  };

  const handleClearAllApps = () => {
    setFormData((prev) => ({
      ...prev,
      assignedApplications: []
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showSnackbar('Name is required', 'error');
      return;
    }
    if (!/^\d{10}$/.test(formData.mobile.trim())) {
      showSnackbar('Enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = { ...formData };
      if (accountType === 'EXTERNAL_CLIENT') {
        payload.role = 'client';
      }

      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, payload);
        showSnackbar(`Account '${formData.name}' updated successfully`, 'success');
      } else {
        await api.post('/users', payload);
        showSnackbar(`Account '${formData.name}' created successfully`, 'success');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Save user error:', err);
      showSnackbar(err.response?.data?.message || 'Failed to save account', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      setPwdSaving(true);
      await api.put(`/users/${pwdUser._id}`, { password: newPassword });
      showSnackbar(`Password reset successfully for ${pwdUser.name}`, 'success');
      setPwdModalOpen(false);
    } catch (err) {
      console.error('Update password error:', err);
      showSnackbar(err.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.isPermanentSuperAdmin) {
      showSnackbar('Primary Super Admin (9345578103) cannot be deleted', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete '${u.name}' (${u.mobile})?`)) {
      return;
    }
    try {
      await api.delete(`/users/${u._id}`);
      showSnackbar(`User '${u.name}' deleted successfully`, 'success');
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
      showSnackbar(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const handleToggleStatus = async (u) => {
    if (u.isPermanentSuperAdmin) {
      showSnackbar('Primary Super Admin (9345578103) cannot be deactivated', 'error');
      return;
    }
    try {
      const nextStatus = !u.isActive;
      await api.put(`/users/${u._id}`, { isActive: nextStatus });
      showSnackbar(`Account '${u.name}' ${nextStatus ? 'activated' : 'deactivated'}`, 'success');
      fetchUsers();
    } catch (err) {
      console.error('Toggle status error:', err);
      showSnackbar(err.response?.data?.message || 'Failed to change status', 'error');
    }
  };

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));

      const isClient = u.role === 'client' || u.role === 'client_admin';
      const matchCategory =
        categoryTab === 'ALL' ||
        (categoryTab === 'INTERNAL_USERS' && !isClient) ||
        (categoryTab === 'EXTERNAL_CLIENTS' && isClient);

      const matchRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'SUPER_ADMIN' && (u.role === 'platform_owner' || u.role === 'super_admin')) ||
        (roleFilter === 'ADMIN' && u.role === 'admin') ||
        (roleFilter === 'CLIENT' && isClient);

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);

      const matchApp =
        appFilter === 'ALL' ||
        (isClient && u.clientAppCode === appFilter) ||
        (!isClient && (u.assignedApplications || []).includes(appFilter));

      return matchSearch && matchCategory && matchRole && matchStatus && matchApp;
    });
  }, [users, search, categoryTab, roleFilter, statusFilter, appFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const superAdmins = users.filter((u) => u.role === 'platform_owner' || u.role === 'super_admin').length;
    const internalAdmins = users.filter((u) => u.role === 'admin').length;
    const externalClients = users.filter((u) => u.role === 'client' || u.role === 'client_admin').length;
    const active = users.filter((u) => u.isActive).length;
    return { total, superAdmins, internalAdmins, externalClients, active };
  }, [users]);

  if (!isSuperAdmin) {
    return (
      <div className="w-full p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Icon name="shield" className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Super Admin Access Only</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          User Management and application assignment is strictly restricted to the Super Admin (9345578103).
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 px-4 sm:px-6 py-4">
      {/* ── TOP HEADER (FULL WIDTH) ── */}
      <div className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-[#84cc16] flex items-center justify-center shadow-xs">
              <Icon name="users" className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                User &amp; Client Access Management
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Super Admin control center: create Renic Soft staff, assign client creation authority per application, and manage external client accounts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Master Super Admin: 9345578103</span>
          </div>

          <button
            onClick={() => openCreateModal('INTERNAL_USER')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-black rounded-xl text-xs transition shadow-xs active:scale-98"
            title="Create internal Renic Soft staff / admin"
          >
            <Icon name="plus" className="w-4 h-4 stroke-[2.5]" />
            <span>Add Renic Soft User</span>
          </button>

          <button
            onClick={() => openCreateModal('EXTERNAL_CLIENT')}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition shadow-xs active:scale-98"
            title="Create client account for an external application"
          >
            <Icon name="store" className="w-4 h-4" />
            <span>Add External Client</span>
          </button>
        </div>
      </div>

      {/* ── METRIC TILES (FULL WIDTH 5-COL GRID) ── */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Accounts</span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</div>
          <span className="text-[10px] text-slate-400 font-medium">Registered in system</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs bg-gradient-to-br from-amber-50/40 to-white">
          <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Super Admins</span>
          <div className="text-2xl font-black text-amber-900 mt-0.5">{stats.superAdmins}</div>
          <span className="text-[10px] text-amber-700 font-medium">Full master authority</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs bg-gradient-to-br from-emerald-50/40 to-white">
          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Renic Soft Admins</span>
          <div className="text-2xl font-black text-emerald-900 mt-0.5">{stats.internalAdmins}</div>
          <span className="text-[10px] text-emerald-700 font-medium">Internal staff with assigned apps</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-2xs bg-gradient-to-br from-sky-50/40 to-white">
          <span className="text-[10px] font-black uppercase text-sky-700 tracking-wider">External Clients</span>
          <div className="text-2xl font-black text-sky-900 mt-0.5">{stats.externalClients}</div>
          <span className="text-[10px] text-sky-700 font-medium">Customers for external apps</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Logins</span>
          <div className="text-2xl font-black text-[#65a30d] mt-0.5">{stats.active} / {stats.total}</div>
          <span className="text-[10px] text-slate-400 font-medium">Permitted accounts</span>
        </div>
      </div>

      {/* ── PRIMARY CATEGORY TABS (INTERNAL USERS vs EXTERNAL CLIENTS) ── */}
      <div className="w-full bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'All Accounts', count: stats.total },
            { id: 'INTERNAL_USERS', label: '🏢 Renic Soft Internal Users (Admins)', count: stats.superAdmins + stats.internalAdmins },
            { id: 'EXTERNAL_CLIENTS', label: '🛍️ External Application Clients', count: stats.externalClients }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${
                categoryTab === tab.id
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                categoryTab === tab.id ? 'bg-[#84cc16] text-[#0f172a]' : 'bg-white text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, 10-digit mobile, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#84cc16] focus:bg-white"
          />
        </div>
      </div>

      {/* ── FILTER CONTROLS BAR (FULL WIDTH) ── */}
      <div className="w-full bg-slate-100/70 p-2.5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2.5 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider pl-1">Filters:</span>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:outline-hidden focus:border-[#84cc16]"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin Only</option>
            <option value="ADMIN">Renic Soft Admin Only</option>
            <option value="CLIENT">Client Only</option>
          </select>

          {/* Application Filter */}
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:outline-hidden focus:border-[#84cc16]"
          >
            <option value="ALL">All Applications</option>
            {applications.map((app) => (
              <option key={app.appCode} value={app.appCode}>
                {app.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:outline-hidden focus:border-[#84cc16]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Deactivated Only</option>
          </select>
        </div>

        <div className="text-slate-500 font-bold text-[11px] pr-1">
          Showing <span className="text-slate-900 font-black">{filteredUsers.length}</span> of {users.length} accounts
        </div>
      </div>

      {/* ── FULL WIDTH ACCOUNTS TABLE ── */}
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
            <Icon name="refresh" className="w-4 h-4 animate-spin text-[#84cc16]" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            No accounts match the selected filters
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs text-left min-w-[980px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Account Details</th>
                  <th className="px-4 py-3.5">Contact &amp; Login</th>
                  <th className="px-4 py-3.5 text-center">Type &amp; Role</th>
                  <th className="px-4 py-3.5">App Creation Authority / Scope</th>
                  <th className="px-4 py-3.5">Permitted Screens</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredUsers.map((u) => {
                  const isSuper = u.role === 'platform_owner' || u.role === 'super_admin';
                  const isClient = u.role === 'client' || u.role === 'client_admin';

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/70 transition">
                      {/* Name & Avatar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-xs ${
                            isSuper
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isClient
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.isPermanentSuperAdmin && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                                  Master
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">ID: {String(u._id).slice(-6)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Mobile & Email */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-900">{u.mobile}</div>
                        {u.email ? (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{u.email}</div>
                        ) : (
                          <div className="text-[10px] text-slate-300 italic">No email</div>
                        )}
                      </td>

                      {/* Account Category & Role */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSuper
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isClient
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            <Icon name={isSuper ? 'shield' : isClient ? 'store' : 'key'} className="w-3 h-3" />
                            <span>{u.roleLabel}</span>
                          </span>

                          <span className="text-[9px] text-slate-400 font-semibold">
                            {isClient ? 'External Application' : 'Renic Soft Internal'}
                          </span>
                        </div>
                      </td>

                      {/* Application Authority */}
                      <td className="px-4 py-3.5">
                        {isSuper ? (
                          <div className="flex items-center gap-1 text-amber-800 font-bold text-[11px]">
                            <Icon name="check" className="w-3.5 h-3.5 text-amber-600" />
                            <span>All Software Applications</span>
                          </div>
                        ) : isClient ? (
                          <div>
                            {u.clientAppCode ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
                                <span>{applications.find(a => a.appCode === u.clientAppCode)?.name || u.clientAppCode}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Client App Not Specified</span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Can Create &amp; Manage Clients For:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                              {(u.assignedApplications || []).length === 0 ? (
                                <span className="text-rose-600 text-[10px] font-bold">No Applications Assigned</span>
                              ) : (
                                (u.assignedApplications || []).map((code) => {
                                  const app = applications.find(a => a.appCode === code);
                                  return (
                                    <span
                                      key={code}
                                      className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-black border border-emerald-200"
                                    >
                                      {app?.name || code}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Allowed Screens */}
                      <td className="px-4 py-3.5">
                        {isSuper ? (
                          <div className="flex items-center gap-1 text-amber-800 font-bold text-[11px]">
                            <Icon name="check" className="w-3.5 h-3.5 text-amber-600" />
                            <span>All Screens (Full Access)</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-800">
                              {(u.allowedPages || []).length} / {modules.length} screens
                            </span>
                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                              {(u.allowedPages || []).slice(0, 3).map((p) => {
                                const found = modules.find((m) => m.path === p);
                                return (
                                  <span
                                    key={p}
                                    className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold border border-slate-200"
                                  >
                                    {found?.label || p}
                                  </span>
                                );
                              })}
                              {(u.allowedPages || []).length > 3 && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  +{(u.allowedPages || []).length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.isPermanentSuperAdmin}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200'
                          } ${u.isPermanentSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title={u.isPermanentSuperAdmin ? 'Primary Super Admin cannot be deactivated' : 'Click to toggle status'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{u.isActive ? 'Active' : 'Deactivated'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Permissions &amp; Applications"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openPasswordModal(u)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Reset Password"
                          >
                            <Icon name="key" className="w-4 h-4" />
                          </button>

                          {!u.isPermanentSuperAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Account"
                            >
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT USER MODAL (SPACIOUS WIDE DIALOG) ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#84cc16] text-[#0f172a] flex items-center justify-center font-bold">
                  <Icon name={editingUser ? 'edit' : 'plus'} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">
                    {editingUser ? `Edit Account: ${editingUser.name}` : 'Create New Account'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define login credentials, configure role, and assign authorized applications and screens
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Account Category Switcher (Only on Create or when permitted) */}
              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Account Classification <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountType('INTERNAL_USER');
                        setFormData({ ...formData, role: 'admin' });
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                        accountType === 'INTERNAL_USER'
                          ? 'border-[#0f172a] bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        accountType === 'INTERNAL_USER' ? 'bg-[#84cc16] text-[#0f172a]' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Icon name="key" className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-xs">Renic Soft Internal User</div>
                        <div className={`text-[10px] ${accountType === 'INTERNAL_USER' ? 'text-slate-400' : 'text-slate-500'}`}>
                          Staff member managing Renic Soft platform &amp; creating clients
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountType('EXTERNAL_CLIENT');
                        setFormData({ ...formData, role: 'client' });
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                        accountType === 'EXTERNAL_CLIENT'
                          ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        accountType === 'EXTERNAL_CLIENT' ? 'bg-white text-sky-700' : 'bg-sky-50 text-sky-700'
                      }`}>
                        <Icon name="store" className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-xs">External Application Client</div>
                        <div className={`text-[10px] ${accountType === 'EXTERNAL_CLIENT' ? 'text-sky-100' : 'text-slate-500'}`}>
                          Customer account for specific external software product
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Profile Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#84cc16]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number (Login ID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.mobile}
                    disabled={editingUser?.isPermanentSuperAdmin}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#84cc16] disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. user@domain.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#84cc16]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingUser ? 'New Password (Leave blank to keep unchanged)' : 'Login Password *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#84cc16]"
                  />
                </div>
              </div>

              {/* ── ROLE SELECTION FOR INTERNAL USERS ── */}
              {accountType === 'INTERNAL_USER' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Internal User Role Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Super Admin */}
                    <label
                      className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        formData.role === 'platform_owner' || formData.role === 'super_admin'
                          ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                          <Icon name="shield" className="w-4 h-4 text-amber-600" />
                          Super Admin
                        </span>
                        <input
                          type="radio"
                          name="userRole"
                          value="platform_owner"
                          disabled={editingUser?.isPermanentSuperAdmin}
                          checked={formData.role === 'platform_owner' || formData.role === 'super_admin'}
                          onChange={() => setFormData({ ...formData, role: 'platform_owner' })}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Master platform authority: can manage all applications, all clients, and create users.
                      </p>
                    </label>

                    {/* Admin */}
                    <label
                      className={`p-3 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        formData.role === 'admin'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      } ${editingUser?.isPermanentSuperAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <Icon name="key" className="w-4 h-4 text-emerald-600" />
                          Renic Soft Admin
                        </span>
                        <input
                          type="radio"
                          name="userRole"
                          value="admin"
                          disabled={editingUser?.isPermanentSuperAdmin}
                          checked={formData.role === 'admin'}
                          onChange={() => setFormData({ ...formData, role: 'admin' })}
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Sub-admin authorized to create and manage clients only for specific assigned applications below.
                      </p>
                    </label>
                  </div>
                </div>
              )}

              {/* ── ASSIGNED APPLICATIONS (FOR ADMINS) ── */}
              {accountType === 'INTERNAL_USER' && (formData.role === 'admin') && (
                <div className="border-2 border-emerald-300 rounded-2xl p-4 bg-emerald-50/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                    <div>
                      <h4 className="text-xs font-black text-emerald-950 flex items-center gap-2">
                        <Icon name="store" className="w-4 h-4 text-emerald-700" />
                        <span>Assigned Software Applications (Client Creation Authority)</span>
                        <span className="px-2 py-0.2 rounded bg-emerald-200 text-emerald-950 text-[10px] font-black">
                          {formData.assignedApplications.length} Assigned
                        </span>
                      </h4>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        This Admin can only create, view, and manage clients/licenses for the applications selected here:
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllApps}
                        className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-300 transition"
                      >
                        All Applications
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllApps}
                        className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-300 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {applications.map((app) => {
                      const isSelected = formData.assignedApplications.includes(app.appCode);
                      return (
                        <div
                          key={app.appCode}
                          onClick={() => handleToggleApplication(app.appCode)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-white border-emerald-500 shadow-xs'
                              : 'bg-white/60 border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block font-black text-slate-900 text-xs">
                              {app.name}
                            </span>
                            <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                              {app.appCode}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── EXTERNAL CLIENT: APPLICATION ATTACHMENT ── */}
              {accountType === 'EXTERNAL_CLIENT' && (
                <div className="border border-sky-300 rounded-2xl p-4 bg-sky-50/50 space-y-3">
                  <h4 className="text-xs font-black text-sky-950 flex items-center gap-2">
                    <Icon name="store" className="w-4 h-4 text-sky-700" />
                    <span>Attached Software Application</span>
                  </h4>
                  <p className="text-[11px] text-sky-800">
                    Select which software product application this client customer account belongs to:
                  </p>

                  <select
                    value={formData.clientAppCode}
                    onChange={(e) => setFormData({ ...formData, clientAppCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-sky-500"
                  >
                    <option value="">Select Application...</option>
                    {applications.map((app) => (
                      <option key={app.appCode} value={app.appCode}>
                        {app.name} ({app.appCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── SCREEN ACCESS ASSIGNMENT MATRIX ── */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>Screen Access Permissions</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">
                        {formData.role === 'platform_owner' || formData.role === 'super_admin'
                          ? 'All Granted'
                          : `${formData.allowedPages.length} Selected`}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Toggle the exact screens this user can view in their navigation and access via URL
                    </p>
                  </div>

                  {formData.role !== 'platform_owner' && formData.role !== 'super_admin' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleSelectAllPages}
                        className="px-2 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 transition"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllPages}
                        className="px-2 py-1 text-[10px] font-black bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 transition"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {formData.role === 'platform_owner' || formData.role === 'super_admin' ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Icon name="shield" className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      Super Admin automatically receives full master access to all screens, applications, and settings.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {modules.map((m) => {
                      const isChecked = formData.allowedPages.includes(m.path);
                      return (
                        <div
                          key={m.path}
                          onClick={() => handleTogglePage(m.path)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                            isChecked
                              ? 'bg-white border-[#84cc16] shadow-xs'
                              : 'bg-slate-100/60 border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-[#84cc16] focus:ring-[#84cc16]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                              <span>{m.label}</span>
                              <span className="font-mono text-[9px] text-slate-400">{m.path}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                              {m.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Toggle (for edits) */}
              {editingUser && !editingUser.isPermanentSuperAdmin && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="block text-xs font-bold text-slate-900">Account Active Status</span>
                    <span className="text-[11px] text-slate-500">Allow or block this user from logging in</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                      formData.isActive
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : 'bg-rose-500 text-white shadow-2xs'
                    }`}
                  >
                    {formData.isActive ? 'Active (Permitted)' : 'Deactivated (Blocked)'}
                  </button>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] transition shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingUser ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QUICK PASSWORD RESET MODAL ── */}
      {pwdModalOpen && pwdUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Icon name="key" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500 font-medium">User: {pwdUser.name} ({pwdUser.mobile})</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:border-[#84cc16]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] shadow-xs disabled:opacity-50"
                >
                  {pwdSaving ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
