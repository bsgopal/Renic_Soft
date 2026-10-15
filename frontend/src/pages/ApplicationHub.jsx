import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { buildCustomerUrl } from '../utils/customerUrl.js';
import SplitDivider from '../components/SplitDivider.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import Modal from '../components/Modal.jsx';

const DEFAULT_NEW_APP = {
  name: '',
  appCode: '',
  urlSlug: '',
  category: 'Retail POS',
  defaultPort: 5180,
  description: '',
  githubUrl: '',
  localRepoPath: '',
  autoExtractAI: true
};

const CATEGORIES = [
  'Retail POS',
  'Marketing SaaS',
  'Logistics',
  'Enterprise ERP',
  'Accounting & ERP',
  'Healthcare',
  'Custom',
  'General'
];

export default function ApplicationHub() {
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [apps, setApps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Selected App in Right Column
  const [selectedApp, setSelectedApp] = useState(null);
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'features' | 'edit'
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [splitPercent, setSplitPercent] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Edit / Register Forms
  const [mode, setMode] = useState(''); // '' | 'create' | 'edit' | 'view'
  const [registerForm, setRegisterForm] = useState(DEFAULT_NEW_APP);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Features / Screens Management State
  const [featureMappingsList, setFeatureMappingsList] = useState([]);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [extractingId, setExtractingId] = useState(null);

  // Solution Modes State
  const [solutionModesList, setSolutionModesList] = useState([]);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [editingModeIndex, setEditingModeIndex] = useState(-1);
  const [savingMode, setSavingMode] = useState(false);
  const [modeForm, setModeForm] = useState({
    modeKey: '',
    displayName: '',
    icon: 'Layers',
    badgeColor: '#84cc16',
    description: '',
    defaultScreenKeys: [],
    isDefault: false
  });

  // Business Types State (Industry Terminology & Button Customization)
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [selectedModeIndexForBt, setSelectedModeIndexForBt] = useState(-1);
  const [editingBtIndex, setEditingBtIndex] = useState(-1);
  const [savingBt, setSavingBt] = useState(false);
  const [btForm, setBtForm] = useState({
    typeKey: '',
    displayName: '',
    icon: 'Building',
    badgeColor: '#3b82f6',
    description: '',
    staffLabel: 'Staff',
    staffPluralLabel: 'Staff Members',
    serviceLabel: 'Service',
    servicePluralLabel: 'Services',
    clientLabel: 'Customer',
    clientPluralLabel: 'Customers',
    bookingActionLabel: 'Book Appointment',
    addServiceBtnText: 'Add Service',
    addStaffBtnText: 'Add Staff',
    defaultSlotDuration: 30,
    defaultBookingBuffer: 0,
    isDefault: false
  });

  // Screen Modal (Add / Edit individual screen)
  const [screenModalOpen, setScreenModalOpen] = useState(false);
  const [editingScreenIndex, setEditingScreenIndex] = useState(-1);
  const [screenForm, setScreenForm] = useState({
    customDisplayName: '',
    technicalTarget: '',
    folderCategory: 'Core Modules',
    screenPath: '',
    description: '',
    defaultEnabled: true
  });

  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [appsRes, clientsRes] = await Promise.all([
        api.get('/applications'),
        api.get('/clients').catch(() => ({ data: [] }))
      ]);
      const appList = appsRes.data.applications || [];
      setApps(appList);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);

      // If an app was currently selected, refresh its object reference
      if (selectedApp) {
        const found = appList.find((a) => a._id === selectedApp._id || a.appCode === selectedApp.appCode);
        if (found) {
          setSelectedApp(found);
          setFeatureMappingsList(found.featureMappings || []);
          setSolutionModesList(found.solutionModes || []);
        }
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedApp, showSnackbar]);

  useEffect(() => {
    fetchData();
  }, []);

  const getAppAssignedClients = useCallback((app) => {
    if (!app || !clients) return [];
    const appCode = (app.appCode || '').trim().toUpperCase();
    const appSlug = (app.urlSlug || '').trim().toLowerCase();
    const appName = (app.name || '').trim().toLowerCase();
    const appId = String(app._id || '');

    return clients.filter((c) => {
      const prod = (c.softwareProduct || '').trim().toUpperCase();
      if (prod && prod === appCode) return true;
      if (c.softwareProduct && c.softwareProduct.toLowerCase() === appSlug) return true;
      if (c.softwareProduct && c.softwareProduct.toLowerCase() === appName) return true;
      if (c.softwareProduct && String(c.softwareProduct) === appId) return true;
      if (Array.isArray(c.allowedApps)) {
        if (c.allowedApps.some((a) => String(a).toUpperCase() === appCode || String(a).toLowerCase() === appSlug || String(a) === appId)) {
          return true;
        }
      }
      return false;
    });
  }, [clients]);

  const handleSelectApp = (app) => {
    setSelectedApp(app);
    setMode('view');
    setActiveTab('customers');
    setCustomerSearch('');
    setEditForm({
      name: app.name || '',
      appCode: app.appCode || '',
      urlSlug: app.urlSlug || '',
      category: app.category || 'General',
      defaultPort: app.defaultPort || 5000,
      description: app.description || '',
      githubUrl: app.githubUrl || app.localRepoPath || '',
      localRepoPath: app.localRepoPath || ''
    });
    setFeatureMappingsList(app.featureMappings || []);
    setSolutionModesList(app.solutionModes || []);
  };

  const handleClosePanel = () => {
    setSelectedApp(null);
    setMode('');
    setIsPanelMaximized(false);
  };

  const handleOpenCreate = () => {
    setSelectedApp(null);
    setMode('create');
    setRegisterForm(DEFAULT_NEW_APP);
  };

  const handleRegisterApp = async (e) => {
    if (e) e.preventDefault();
    if (!registerForm.name || !registerForm.appCode || !registerForm.defaultPort) {
      showSnackbar('Please provide App Name, Technical Code, and Default Port', 'warning');
      return;
    }

    try {
      setRegisterSubmitting(true);
      const res = await api.post('/applications', {
        name: registerForm.name,
        appCode: registerForm.appCode,
        urlSlug: registerForm.urlSlug || registerForm.appCode.toLowerCase(),
        category: registerForm.category,
        defaultPort: Number(registerForm.defaultPort),
        description: registerForm.description,
        githubUrl: registerForm.githubUrl || registerForm.localRepoPath
      });

      const createdApp = res.data.application;
      showSnackbar(`Application "${createdApp.name}" registered successfully!`, 'success');

      if (registerForm.autoExtractAI && (registerForm.githubUrl || registerForm.localRepoPath)) {
        try {
          await api.post('/applications/ai-extract', {
            appCode: createdApp.appCode,
            repoPath: registerForm.localRepoPath || registerForm.githubUrl
          });
        } catch {
          // ignore
        }
      }

      setMode('view');
      setSelectedApp(createdApp);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to register application', 'error');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const handleUpdateApp = async (e) => {
    if (e) e.preventDefault();
    if (!selectedApp) return;
    try {
      setEditSubmitting(true);
      await api.put(`/applications/${selectedApp._id}`, editForm);
      showSnackbar(`Updated "${editForm.name}" successfully!`, 'success');
      handleClosePanel();
      await fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update application', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteApp = async (app) => {
    if (app.isSystem) {
      showSnackbar('Core system applications cannot be removed.', 'warning');
      return;
    }
    const assignedCount = getAppAssignedClients(app).length;
    const ok = await confirmDialog({
      title: `Delete Application "${app.name}"?`,
      message: `Are you sure you want to delete this application?${assignedCount > 0 ? ` WARNING: ${assignedCount} customer tenant(s) are assigned to it.` : ''}`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/applications/${app._id}`);
      showSnackbar(`Application "${app.name}" deleted`, 'success');
      setSelectedApp(null);
      setMode('');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete application', 'error');
    }
  };

  const handleSyncGit = async (app) => {
    try {
      setSyncingId(app._id);
      const res = await api.post(`/applications/${app._id}/git-sync`);
      showSnackbar(`Git Sync Complete: Commit ${res.data.commitHash || 'OK'}`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Git pull failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleExtractAI = async (app) => {
    try {
      setExtractingId(app._id);
      const res = await api.post('/applications/ai-extract', {
        appCode: app.appCode,
        repoPath: app.localRepoPath || app.githubUrl
      });
      showSnackbar(`AI Extracted ${res.data.discoveredCount || 0} features & screens!`, 'success');
      if (res.data.featureMappings?.length) {
        setFeatureMappingsList(res.data.featureMappings);
        await api.put(`/applications/${app._id}/feature-mappings`, {
          featureMappings: res.data.featureMappings
        });
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'AI route extraction failed', 'error');
    } finally {
      setExtractingId(null);
    }
  };

  // Screen Management Handlers
  const handleOpenAddScreen = () => {
    setEditingScreenIndex(-1);
    setScreenForm({
      customDisplayName: '',
      technicalTarget: '',
      folderCategory: 'Core Modules',
      screenPath: '',
      description: '',
      defaultEnabled: true
    });
    setScreenModalOpen(true);
  };

  const handleOpenEditScreen = (screen, index) => {
    setEditingScreenIndex(index);
    setScreenForm({
      customDisplayName: screen.customDisplayName || screen.label || '',
      technicalTarget: screen.technicalTarget || screen.key || '',
      folderCategory: screen.folderCategory || screen.category || 'Core Modules',
      screenPath: screen.screenPath || screen.path || '',
      description: screen.description || '',
      defaultEnabled: screen.defaultEnabled !== false
    });
    setScreenModalOpen(true);
  };

  const handleSaveScreenModal = async (e) => {
    if (e) e.preventDefault();
    if (!screenForm.customDisplayName || !screenForm.technicalTarget) {
      showSnackbar('Display Name and Technical Target Key are required', 'warning');
      return;
    }

    const updatedList = [...featureMappingsList];
    const newEntry = {
      customDisplayName: screenForm.customDisplayName.trim(),
      technicalTarget: screenForm.technicalTarget.trim(),
      folderCategory: screenForm.folderCategory.trim() || 'Core Modules',
      screenPath: screenForm.screenPath.trim() || `/${screenForm.technicalTarget.trim()}`,
      description: screenForm.description.trim(),
      defaultEnabled: Boolean(screenForm.defaultEnabled)
    };

    if (editingScreenIndex >= 0) {
      updatedList[editingScreenIndex] = newEntry;
    } else {
      // Check for duplicate key
      if (updatedList.some((s) => s.technicalTarget === newEntry.technicalTarget)) {
        showSnackbar(`A screen with key '${newEntry.technicalTarget}' already exists!`, 'warning');
        return;
      }
      updatedList.push(newEntry);
    }

    try {
      setSavingFeatures(true);
      await api.put(`/applications/${selectedApp._id}/feature-mappings`, {
        featureMappings: updatedList
      });
      setFeatureMappingsList(updatedList);
      showSnackbar(editingScreenIndex >= 0 ? 'Screen updated successfully!' : 'New Screen added successfully!', 'success');
      setScreenModalOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save screen', 'error');
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleDeleteScreen = async (index) => {
    const item = featureMappingsList[index];
    const ok = await confirmDialog({
      title: `Delete Screen "${item.customDisplayName || item.technicalTarget}"?`,
      message: 'Are you sure you want to remove this screen module from the application?',
      confirmText: 'Delete Screen',
      danger: true
    });
    if (!ok) return;

    const updatedList = featureMappingsList.filter((_, i) => i !== index);
    try {
      setSavingFeatures(true);
      await api.put(`/applications/${selectedApp._id}/feature-mappings`, {
        featureMappings: updatedList
      });
      setFeatureMappingsList(updatedList);
      showSnackbar('Screen removed', 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to remove screen', 'error');
    } finally {
      setSavingFeatures(false);
    }
  };

  // Solution Mode Handlers
  const handleOpenAddMode = () => {
    setEditingModeIndex(-1);
    setModeForm({
      modeKey: '',
      displayName: '',
      icon: 'Layers',
      badgeColor: '#84cc16',
      description: '',
      defaultScreenKeys: featureMappingsList.map((f) => f.technicalTarget || f.key),
      isDefault: false
    });
    setModeModalOpen(true);
  };

  const handleOpenEditMode = (modeItem, index) => {
    setEditingModeIndex(index);
    setModeForm({
      modeKey: modeItem.modeKey || '',
      displayName: modeItem.displayName || '',
      icon: modeItem.icon || 'Layers',
      badgeColor: modeItem.badgeColor || '#84cc16',
      description: modeItem.description || '',
      defaultScreenKeys: modeItem.defaultScreenKeys || [],
      isDefault: Boolean(modeItem.isDefault)
    });
    setModeModalOpen(true);
  };

  const handleSaveModeModal = async (e) => {
    if (e) e.preventDefault();
    if (!modeForm.displayName || !modeForm.modeKey) {
      showSnackbar('Display Name and Mode Key are required', 'warning');
      return;
    }

    const updatedModes = [...solutionModesList];
    const newEntry = {
      modeKey: modeForm.modeKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      displayName: modeForm.displayName.trim(),
      icon: modeForm.icon.trim() || 'Layers',
      badgeColor: modeForm.badgeColor.trim() || '#84cc16',
      description: modeForm.description.trim(),
      defaultScreenKeys: modeForm.defaultScreenKeys || [],
      businessTypes: editingModeIndex >= 0 ? (solutionModesList[editingModeIndex]?.businessTypes || []) : [],
      isDefault: Boolean(modeForm.isDefault)
    };

    if (editingModeIndex >= 0) {
      updatedModes[editingModeIndex] = newEntry;
    } else {
      if (updatedModes.some((m) => m.modeKey === newEntry.modeKey)) {
        showSnackbar(`A mode with key '${newEntry.modeKey}' already exists!`, 'warning');
        return;
      }
      updatedModes.push(newEntry);
    }

    try {
      setSavingMode(true);
      await api.put(`/applications/${selectedApp._id}/solution-modes`, {
        solutionModes: updatedModes
      });
      setSolutionModesList(updatedModes);
      showSnackbar(editingModeIndex >= 0 ? 'Solution Mode updated!' : 'New Solution Mode created!', 'success');
      setModeModalOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save solution mode', 'error');
    } finally {
      setSavingMode(false);
    }
  };

  const handleDeleteMode = async (index) => {
    const item = solutionModesList[index];
    const ok = await confirmDialog({
      title: `Delete Solution Mode "${item.displayName}"?`,
      message: 'Are you sure you want to delete this operational mode preset?',
      confirmText: 'Delete Mode',
      danger: true
    });
    if (!ok) return;

    const updatedModes = solutionModesList.filter((_, i) => i !== index);
    try {
      setSavingMode(true);
      await api.put(`/applications/${selectedApp._id}/solution-modes`, {
        solutionModes: updatedModes
      });
      setSolutionModesList(updatedModes);
      showSnackbar('Solution Mode deleted', 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete solution mode', 'error');
    } finally {
      setSavingMode(false);
    }
  };

  // Business Types Handlers
  const handleOpenAddBt = (modeIndex) => {
    setSelectedModeIndexForBt(modeIndex);
    setEditingBtIndex(-1);
    setBtForm({
      typeKey: '',
      displayName: '',
      icon: 'Building',
      badgeColor: '#3b82f6',
      description: '',
      staffLabel: 'Staff',
      staffPluralLabel: 'Staff Members',
      serviceLabel: 'Service',
      servicePluralLabel: 'Services',
      clientLabel: 'Customer',
      clientPluralLabel: 'Customers',
      bookingActionLabel: 'Book Appointment',
      addServiceBtnText: 'Add Service',
      addStaffBtnText: 'Add Staff',
      defaultSlotDuration: 30,
      defaultBookingBuffer: 0,
      isDefault: false
    });
    setBtModalOpen(true);
  };

  const handleOpenEditBt = (modeIndex, bt, btIndex) => {
    setSelectedModeIndexForBt(modeIndex);
    setEditingBtIndex(btIndex);
    setBtForm({
      typeKey: bt.typeKey || '',
      displayName: bt.displayName || '',
      icon: bt.icon || 'Building',
      badgeColor: bt.badgeColor || '#3b82f6',
      description: bt.description || '',
      staffLabel: bt.staffLabel || 'Staff',
      staffPluralLabel: bt.staffPluralLabel || 'Staff Members',
      serviceLabel: bt.serviceLabel || 'Service',
      servicePluralLabel: bt.servicePluralLabel || 'Services',
      clientLabel: bt.clientLabel || 'Customer',
      clientPluralLabel: bt.clientPluralLabel || 'Customers',
      bookingActionLabel: bt.bookingActionLabel || 'Book Appointment',
      addServiceBtnText: bt.addServiceBtnText || 'Add Service',
      addStaffBtnText: bt.addStaffBtnText || 'Add Staff',
      defaultSlotDuration: bt.defaultSlotDuration || 30,
      defaultBookingBuffer: bt.defaultBookingBuffer || 0,
      isDefault: Boolean(bt.isDefault)
    });
    setBtModalOpen(true);
  };

  const handleSaveBtModal = async (e) => {
    if (e) e.preventDefault();
    if (selectedModeIndexForBt < 0 || !btForm.displayName || !btForm.typeKey) {
      showSnackbar('Display Name and Type Key are required', 'warning');
      return;
    }

    const updatedModes = [...solutionModesList];
    const targetMode = { ...updatedModes[selectedModeIndexForBt] };
    const bts = [...(targetMode.businessTypes || [])];

    const cleanKey = btForm.typeKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const newBt = {
      typeKey: cleanKey,
      displayName: btForm.displayName.trim(),
      icon: btForm.icon.trim() || 'Building',
      badgeColor: btForm.badgeColor.trim() || '#3b82f6',
      description: btForm.description.trim(),
      staffLabel: btForm.staffLabel.trim() || 'Staff',
      staffPluralLabel: btForm.staffPluralLabel.trim() || 'Staff Members',
      serviceLabel: btForm.serviceLabel.trim() || 'Service',
      servicePluralLabel: btForm.servicePluralLabel.trim() || 'Services',
      clientLabel: btForm.clientLabel.trim() || 'Customer',
      clientPluralLabel: btForm.clientPluralLabel.trim() || 'Customers',
      bookingActionLabel: btForm.bookingActionLabel.trim() || 'Book Appointment',
      addServiceBtnText: btForm.addServiceBtnText.trim() || 'Add Service',
      addStaffBtnText: btForm.addStaffBtnText.trim() || 'Add Staff',
      defaultSlotDuration: Number(btForm.defaultSlotDuration) || 30,
      defaultBookingBuffer: Number(btForm.defaultBookingBuffer) || 0,
      isDefault: Boolean(btForm.isDefault)
    };

    if (editingBtIndex >= 0) {
      bts[editingBtIndex] = newBt;
    } else {
      if (bts.some((b) => b.typeKey === newBt.typeKey)) {
        showSnackbar(`Business type with key '${newBt.typeKey}' already exists in this mode!`, 'warning');
        return;
      }
      bts.push(newBt);
    }

    targetMode.businessTypes = bts;
    updatedModes[selectedModeIndexForBt] = targetMode;

    try {
      setSavingBt(true);
      await api.put(`/applications/${selectedApp._id}/solution-modes`, {
        solutionModes: updatedModes
      });
      setSolutionModesList(updatedModes);
      showSnackbar(editingBtIndex >= 0 ? 'Business Type updated!' : 'New Business Type created!', 'success');
      setBtModalOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save business type', 'error');
    } finally {
      setSavingBt(false);
    }
  };

  const handleDeleteBt = async (modeIndex, btIndex) => {
    const targetMode = solutionModesList[modeIndex];
    const bt = targetMode?.businessTypes?.[btIndex];
    if (!bt) return;

    const ok = await confirmDialog({
      title: `Delete Business Type "${bt.displayName}"?`,
      message: 'Are you sure you want to remove this industry business profile?',
      confirmText: 'Delete Business Type',
      danger: true
    });
    if (!ok) return;

    const updatedModes = [...solutionModesList];
    const m = { ...updatedModes[modeIndex] };
    m.businessTypes = (m.businessTypes || []).filter((_, i) => i !== btIndex);
    updatedModes[modeIndex] = m;

    try {
      setSavingBt(true);
      await api.put(`/applications/${selectedApp._id}/solution-modes`, {
        solutionModes: updatedModes
      });
      setSolutionModesList(updatedModes);
      showSnackbar('Business Type removed', 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to remove business type', 'error');
    } finally {
      setSavingBt(false);
    }
  };

  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      const matchSearch = (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (a.appCode || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || a.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [apps, search, categoryFilter]);

  const assignedClients = selectedApp ? getAppAssignedClients(selectedApp) : [];
  const filteredAssignedClients = useMemo(() => {
    if (!customerSearch) return assignedClients;
    const term = customerSearch.toLowerCase();
    return assignedClients.filter((c) =>
      (c.name || '').toLowerCase().includes(term) ||
      (c.customerCode || '').toLowerCase().includes(term) ||
      (c.subdomain || '').toLowerCase().includes(term)
    );
  }, [assignedClients, customerSearch]);

  const isDetailOpen = mode === 'create' || Boolean(selectedApp);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ LEFT COLUMN: APPLICATIONS LIST ============ */}
      {!isPanelMaximized && (
        <div
          style={{ width: isDetailOpen ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 200ms ease' }}
          className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0"
        >
          {/* Top Control Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search applications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <button
              onClick={() => fetchData()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#65a30d]' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> Register App
            </button>
          </div>

          {/* Subheader */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">Applications ({filteredApps.length})</span>
            <span className="text-[11px] text-slate-400">Click row to open details</span>
          </div>

          {/* App List Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Application / Code</th>
                  <th className="py-2 px-2">Port</th>
                  <th className="py-2 px-2 text-center">Tenants</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading applications...</span>
                    </td>
                  </tr>
                ) : filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No applications registered</p>
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((a) => {
                    const isSelected = selectedApp?._id === a._id && mode;
                    const tenantCount = getAppAssignedClients(a).length;

                    return (
                      <tr
                        key={a._id}
                        onClick={() => handleSelectApp(a)}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-lime-50/70 border-l-4 border-l-[#84cc16]'
                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Application Name & Code */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{a.name}</span>
                            {a.isSystem && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                Core
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 font-bold mt-0.5">
                            {a.appCode}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {a.category} · /{a.urlSlug}
                          </div>
                        </td>

                        {/* Port */}
                        <td className="py-2.5 px-2 align-top font-mono font-bold text-slate-700">
                          :{a.defaultPort}
                        </td>

                        {/* Tenants Count */}
                        <td className="py-2.5 px-2 align-top text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            {tenantCount}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleSyncGit(a)}
                              disabled={syncingId === a._id}
                              className="p-1 text-slate-400 hover:text-[#65a30d] hover:bg-lime-50 rounded transition"
                              title="Git Sync"
                            >
                              <Icon name="refresh" className={`w-3.5 h-3.5 ${syncingId === a._id ? 'animate-spin text-[#65a30d]' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Draggable Resizer */}
      {isDetailOpen && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: APPLICATION STUDIO & DETAIL VIEW ============ */}
      {mode === 'create' ? (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClosePanel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                title="Back to Apps List"
              >
                <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
              </button>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Register New Software Application</h2>
            </div>
            <button onClick={handleClosePanel} className="p-1.5 text-slate-400 hover:text-slate-900 rounded">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
            <form onSubmit={handleRegisterApp} className="space-y-4 max-w-2xl bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Application Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Garments Logistics & Dispatch"
                    value={registerForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const code = val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
                      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
                      setRegisterForm({ ...registerForm, name: val, appCode: code, urlSlug: slug });
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technical App Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GARMENTS_LOGISTICS"
                    value={registerForm.appCode}
                    onChange={(e) => setRegisterForm({ ...registerForm, appCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL Subdomain Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="logistics"
                    value={registerForm.urlSlug}
                    onChange={(e) => setRegisterForm({ ...registerForm, urlSlug: e.target.value.toLowerCase() })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Local Port *</label>
                  <input
                    type="number"
                    required
                    value={registerForm.defaultPort}
                    onChange={(e) => setRegisterForm({ ...registerForm, defaultPort: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={registerForm.description}
                  onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                  placeholder="App capabilities and routing details..."
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="px-5 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded shadow-xs"
                >
                  {registerSubmitting ? 'Registering...' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : selectedApp ? (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {selectedApp.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-emerald-400">
                    {selectedApp.appCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Default Port: <b className="text-slate-800 font-mono">:{selectedApp.defaultPort}</b> · Subdomain Slug: <b className="text-slate-800 font-mono">/{selectedApp.urlSlug}</b> · Subscribed Tenants: <b className="text-emerald-700">{assignedClients.length}</b>
                </p>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Apps List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncGit(selectedApp)}
                  className="p-1.5 text-slate-500 hover:text-[#65a30d] hover:bg-slate-100 rounded transition"
                  title="Git Sync"
                >
                  <Icon name="refresh" className={`w-4 h-4 ${syncingId === selectedApp._id ? 'animate-spin text-[#65a30d]' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
                  title="Edit Entire Application"
                >
                  <Icon name="edit" className="w-3.5 h-3.5" /> Edit App
                </button>
                <button
                  type="button"
                  onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                  title={isPanelMaximized ? 'Restore Split View' : 'Maximize Full View'}
                >
                  <Icon name="expand" className="w-4 h-4" />
                </button>
                {!selectedApp.isSystem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteApp(selectedApp)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                    title="Delete Application"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                  title="Close"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="border-b border-slate-200 bg-white px-4 flex items-center gap-6 overflow-x-auto no-scrollbar flex-shrink-0 text-xs font-semibold">
            {[
              { id: 'customers', label: `Subscribed Customers (${assignedClients.length})` },
              { id: 'features', label: `Screens & Modules (${featureMappingsList.length})` },
              { id: 'modes', label: `Solution Modes & Business Types (${solutionModesList.length})` },
              { id: 'edit', label: '✏️ Edit Entire Application' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 transition relative whitespace-nowrap ${
                    isActive ? 'text-[#65a30d] font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#84cc16]" />}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
            {/* TAB 1: Subscribed Customers */}
            {activeTab === 'customers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">Subscribed Tenants:</span>
                  <input
                    type="text"
                    placeholder="Search tenant..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-44 px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                  />
                </div>

                {filteredAssignedClients.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No customers assigned to this software application yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAssignedClients.map((c) => {
                      const smartSlug = selectedApp.urlSlug || 'app';
                      const url = buildCustomerUrl(c, smartSlug) || c.fullSaaSDomain || '';

                      return (
                        <div key={c._id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                {c.customerCode}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-emerald-700 mt-0.5 truncate max-w-sm">
                              {url}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {c.licenseStatus || 'Active'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Dynamic Feature Mappings & Screens */}
            {activeTab === 'features' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Application Screens &amp; Permission Modules</h3>
                    <p className="text-[11px] text-slate-500">
                      These screens dynamically propagate to Plan Tiers and Tenant License management.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExtractAI(selectedApp)}
                      disabled={extractingId === selectedApp._id}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition"
                    >
                      <Icon name="refresh" className={`w-3.5 h-3.5 ${extractingId === selectedApp._id ? 'animate-spin text-[#65a30d]' : ''}`} />
                      AI Scan Routes
                    </button>
                    <button
                      onClick={handleOpenAddScreen}
                      className="px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      Add Screen Module
                    </button>
                  </div>
                </div>

                {featureMappingsList.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    <Icon name="layers" className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No screen modules defined yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click &quot;Add Screen Module&quot; or &quot;AI Scan Routes&quot; to populate screens for this app.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <tr>
                          <th className="py-2.5 px-3">Screen Name &amp; Key</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Route Path</th>
                          <th className="py-2.5 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {featureMappingsList.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{f.customDisplayName || f.label || f.technicalTarget}</span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">{f.technicalTarget || f.key}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {f.folderCategory || f.category || 'Core'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {f.screenPath || `/${f.technicalTarget || f.key}`}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditScreen(f, i)}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                                  title="Edit Screen"
                                >
                                  <Icon name="edit" className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteScreen(i)}
                                  disabled={savingFeatures}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                  title="Delete Screen"
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Dynamic Solution Modes & Presets */}
            {activeTab === 'modes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Operational Solution Modes &amp; Preset Profiles</h3>
                    <p className="text-[11px] text-slate-500">
                      When provisioning new customer licenses, selecting a mode automatically ticks its default screens &amp; features.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddMode}
                    className="px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    Create Solution Mode
                  </button>
                </div>

                {solutionModesList.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    <Icon name="layers" className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No custom solution modes created yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click &quot;Create Solution Mode&quot; to define customer onboarding presets.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {solutionModesList.map((m, i) => (
                      <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        {/* Mode Header Bar */}
                        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="w-4 h-4 rounded-full flex-shrink-0 mt-1 shadow-xs"
                              style={{ backgroundColor: m.badgeColor || '#84cc16' }}
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900">{m.displayName}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800 border border-slate-300">
                                  {m.modeKey}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {(m.businessTypes || []).length} Industry Profile{(m.businessTypes || []).length === 1 ? '' : 's'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{m.description || 'No description provided'}</p>
                              
                              {/* Ticked Screens Chips */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Default Screens:</span>
                                {(m.defaultScreenKeys || []).length === 0 ? (
                                  <span className="text-[10px] text-slate-400 italic">No screens assigned</span>
                                ) : (
                                  (m.defaultScreenKeys || []).map((sk, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700 border border-slate-200 font-semibold shadow-2xs">
                                      {sk}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Mode Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenAddBt(i)}
                              className="px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
                            >
                              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> Add Business Type
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditMode(m, i)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg transition"
                              title="Edit Mode Settings"
                            >
                              <Icon name="edit" className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMode(i)}
                              disabled={savingMode}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Solution Mode"
                            >
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Business Types Table View */}
                        {(m.businessTypes || []).length === 0 ? (
                          <div className="p-6 text-center bg-white text-slate-400 text-xs">
                            <p className="font-bold text-slate-500">No industry business types configured for this mode.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;+ Add Business Type&quot; above to create dynamic button labels for doctors, salons, hotels, etc.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto bg-white border-t border-slate-200">
                            <table className="w-full min-w-[920px] text-left border-collapse text-xs">
                              <thead className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                <tr>
                                  <th className="py-3 px-4 min-w-[220px]">Industry Business Type</th>
                                  <th className="py-3 px-4 min-w-[190px]">Service Button &amp; Label</th>
                                  <th className="py-3 px-4 min-w-[190px]">Staff Button &amp; Label</th>
                                  <th className="py-3 px-4 min-w-[180px]">Booking Action Button</th>
                                  <th className="py-3 px-4 min-w-[120px]">Slot / Buffer</th>
                                  <th className="py-3 px-4 text-right min-w-[90px]">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(m.businessTypes || []).map((bt, btIdx) => (
                                  <tr key={btIdx} className="hover:bg-slate-50/80 transition">
                                    <td className="py-3.5 px-4 align-top">
                                      <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                          style={{ backgroundColor: bt.badgeColor || '#3b82f6' }}
                                        />
                                        <span>{bt.displayName}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-500 font-semibold block mt-0.5">
                                        [{bt.typeKey}]
                                      </span>
                                      {bt.description && (
                                        <span className="text-[11px] text-slate-500 block mt-1 leading-snug">
                                          {bt.description}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-bold text-emerald-800 block text-xs">
                                        {bt.serviceLabel}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/80 inline-block mt-1">
                                        Btn: &quot;{bt.addServiceBtnText || ('Add ' + bt.serviceLabel)}&quot;
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-bold text-blue-800 block text-xs">
                                        {bt.staffLabel}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200/80 inline-block mt-1">
                                        Btn: &quot;{bt.addStaffBtnText || ('Add ' + bt.staffLabel)}&quot;
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="font-bold text-slate-900 block text-xs">
                                        &quot;{bt.bookingActionLabel}&quot;
                                      </span>
                                      <span className="text-[11px] text-slate-600 block mt-1">
                                        Client: <b className="text-purple-700 font-bold">{bt.clientLabel}</b>
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 align-top text-[11px] text-slate-700 font-medium">
                                      <div>Slot: <b className="text-slate-900">{bt.defaultSlotDuration || 30} mins</b></div>
                                      <div className="text-slate-500 mt-0.5">Buffer: <b className="text-slate-800">{bt.defaultBookingBuffer || 0} mins</b></div>
                                    </td>
                                    <td className="py-3.5 px-4 align-top text-right">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditBt(i, bt, btIdx)}
                                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                          title="Edit Business Type & Buttons"
                                        >
                                          <Icon name="edit" className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBt(i, btIdx)}
                                          disabled={savingBt}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                          title="Delete Business Type"
                                        >
                                          <Icon name="trash" className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Edit App Settings */}
            {activeTab === 'edit' && (
              <form onSubmit={handleUpdateApp} className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Application Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Technical App Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TEXTILE_POS"
                      value={editForm.appCode || ''}
                      onChange={(e) => setEditForm({ ...editForm, appCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">URL Slug</label>
                    <input
                      type="text"
                      value={editForm.urlSlug || ''}
                      onChange={(e) => setEditForm({ ...editForm, urlSlug: e.target.value.toLowerCase() })}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={editForm.category || 'General'}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Default Port</label>
                    <input
                      type="number"
                      value={editForm.defaultPort || 5000}
                      onChange={(e) => setEditForm({ ...editForm, defaultPort: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Local Repo Path / GitHub URL</label>
                  <input
                    type="text"
                    placeholder="e.g. D:/Development/MyNewApp or https://github.com/..."
                    value={editForm.localRepoPath || editForm.githubUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, localRepoPath: e.target.value, githubUrl: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Describe application features..."
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-5 py-2 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                  >
                    {editSubmitting ? 'Saving Settings...' : 'Save App Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Permanent Sticky Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0 z-10">
            <span className="text-xs text-slate-500 font-bold">
              App Code: <b className="text-slate-900 font-mono">{selectedApp.appCode}</b> · Engine: <b className="text-slate-700">{selectedApp.category || 'PaaS'}</b>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClosePanel}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
              >
                Close Panel
              </button>
              {activeTab === 'edit' && (
                <button
                  type="button"
                  onClick={handleUpdateApp}
                  disabled={editSubmitting}
                  className="px-5 py-1.5 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                >
                  {editSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Screen Add / Edit Modal */}
      {screenModalOpen && (
        <Modal
          title={editingScreenIndex >= 0 ? 'Edit Screen Module' : 'Add New Screen Module'}
          onClose={() => setScreenModalOpen(false)}
        >
          <form onSubmit={handleSaveScreenModal} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Reports & Margins"
                  value={screenForm.customDisplayName}
                  onChange={(e) => setScreenForm({ ...screenForm, customDisplayName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Technical Key / Target *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. salesReports"
                  value={screenForm.technicalTarget}
                  onChange={(e) => setScreenForm({ ...screenForm, technicalTarget: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category / Group</label>
                <input
                  type="text"
                  placeholder="e.g. Sales & Billing, CRM, Inventory"
                  value={screenForm.folderCategory}
                  onChange={(e) => setScreenForm({ ...screenForm, folderCategory: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Route Path</label>
                <input
                  type="text"
                  placeholder="e.g. /sales-reports"
                  value={screenForm.screenPath}
                  onChange={(e) => setScreenForm({ ...screenForm, screenPath: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Details about what this screen does..."
                value={screenForm.description}
                onChange={(e) => setScreenForm({ ...screenForm, description: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={screenForm.defaultEnabled}
                  onChange={(e) => setScreenForm({ ...screenForm, defaultEnabled: e.target.checked })}
                  className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16]"
                />
                <span>Enabled by default in standard plans</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreenModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFeatures}
                  className="px-5 py-1.5 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs"
                >
                  {savingFeatures ? 'Saving...' : 'Save Screen'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Solution Mode Add / Edit Modal */}
      {modeModalOpen && (
        <Modal
          title={editingModeIndex >= 0 ? 'Edit Solution Mode Preset' : 'Create New Solution Mode Preset'}
          onClose={() => setModeModalOpen(false)}
        >
          <form onSubmit={handleSaveModeModal} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mode Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doctor & Clinic Booking"
                  value={modeForm.displayName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const key = val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 25);
                    setModeForm({
                      ...modeForm,
                      displayName: val,
                      modeKey: editingModeIndex >= 0 ? modeForm.modeKey : key
                    });
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Technical Mode Key *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CLINIC_BOOKING"
                  value={modeForm.modeKey}
                  onChange={(e) => setModeForm({ ...modeForm, modeKey: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Badge Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={modeForm.badgeColor}
                    onChange={(e) => setModeForm({ ...modeForm, badgeColor: e.target.value })}
                    className="w-8 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={modeForm.badgeColor}
                    onChange={(e) => setModeForm({ ...modeForm, badgeColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-xs font-mono rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Icon Name</label>
                <input
                  type="text"
                  placeholder="e.g. Calendar, Send, Bot, Sparkles"
                  value={modeForm.icon}
                  onChange={(e) => setModeForm({ ...modeForm, icon: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Target industry and what capabilities this mode unlocks..."
                value={modeForm.description}
                onChange={(e) => setModeForm({ ...modeForm, description: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Default Ticked Screens for this Mode ({modeForm.defaultScreenKeys?.length || 0})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModeForm({ ...modeForm, defaultScreenKeys: featureMappingsList.map(f => f.technicalTarget || f.key) })}
                    className="text-[11px] text-[#65a30d] font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeForm({ ...modeForm, defaultScreenKeys: [] })}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto p-2.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {featureMappingsList.map((f, idx) => {
                  const key = f.technicalTarget || f.key;
                  const isChecked = (modeForm.defaultScreenKeys || []).includes(key);

                  return (
                    <label key={idx} className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const cur = modeForm.defaultScreenKeys || [];
                          const updated = e.target.checked
                            ? [...cur, key]
                            : cur.filter(k => k !== key);
                          setModeForm({ ...modeForm, defaultScreenKeys: updated });
                        }}
                        className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16]"
                      />
                      <span className="text-[11px] font-medium text-slate-800 truncate">
                        {f.customDisplayName || f.label || key}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModeModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMode}
                className="px-5 py-1.5 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs"
              >
                {savingMode ? 'Saving...' : 'Save Solution Mode'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Business Type (Industry Terminology & Button Names) Modal */}
      {btModalOpen && (
        <Modal
          title={editingBtIndex >= 0 ? `Edit Business Profile: ${btForm.displayName}` : 'Create New Business Profile & Terminology'}
          onClose={() => setBtModalOpen(false)}
        >
          <form onSubmit={handleSaveBtModal} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            {/* Core Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                1. Industry Profile Identity
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Business Type Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hotel & Resort Room Booking"
                    value={btForm.displayName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const key = val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 25);
                      setBtForm({
                        ...btForm,
                        displayName: val,
                        typeKey: editingBtIndex >= 0 ? btForm.typeKey : key
                      });
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technical Type Key *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOTEL_BOOKING"
                    value={btForm.typeKey}
                    onChange={(e) => setBtForm({ ...btForm, typeKey: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Badge Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={btForm.badgeColor}
                      onChange={(e) => setBtForm({ ...btForm, badgeColor: e.target.value })}
                      className="w-8 h-7 p-0 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={btForm.badgeColor}
                      onChange={(e) => setBtForm({ ...btForm, badgeColor: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-xs font-mono rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Icon Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Building, Hospital, Scissors, Activity"
                    value={btForm.icon}
                    onChange={(e) => setBtForm({ ...btForm, icon: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Target market (e.g. Hotels, Resorts, Spas, Turfs, Clinics)..."
                  value={btForm.description}
                  onChange={(e) => setBtForm({ ...btForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            {/* Entity Terminology Dictionary */}
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide block">
                2. Dynamic Entity Terminology (Labels on Tables &amp; Cards)
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service / Offering Label (Singular)</label>
                  <input
                    type="text"
                    placeholder="e.g. Room Type / Suite, Treatment, Haircut"
                    value={btForm.serviceLabel}
                    onChange={(e) => setBtForm({ ...btForm, serviceLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Label (Plural)</label>
                  <input
                    type="text"
                    placeholder="e.g. Room Types & Suites, Treatments"
                    value={btForm.servicePluralLabel}
                    onChange={(e) => setBtForm({ ...btForm, servicePluralLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff / Provider Label (Singular)</label>
                  <input
                    type="text"
                    placeholder="e.g. Front Desk / Host, Doctor, Stylist"
                    value={btForm.staffLabel}
                    onChange={(e) => setBtForm({ ...btForm, staffLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff Label (Plural)</label>
                  <input
                    type="text"
                    placeholder="e.g. Desk Concierges, Doctors, Stylists"
                    value={btForm.staffPluralLabel}
                    onChange={(e) => setBtForm({ ...btForm, staffPluralLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Client / Customer Label (Singular)</label>
                  <input
                    type="text"
                    placeholder="e.g. Guest, Patient, Client, Player"
                    value={btForm.clientLabel}
                    onChange={(e) => setBtForm({ ...btForm, clientLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Client Label (Plural)</label>
                  <input
                    type="text"
                    placeholder="e.g. Guests, Patients, Clients, Players"
                    value={btForm.clientPluralLabel}
                    onChange={(e) => setBtForm({ ...btForm, clientPluralLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Buttons Customization */}
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide block">
                3. Dynamic Button Text Customization (Zero Code Touch)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Add Service Button Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Add Room Type / Suite"
                    value={btForm.addServiceBtnText}
                    onChange={(e) => setBtForm({ ...btForm, addServiceBtnText: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-emerald-500 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Add Staff Button Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Add Concierge / Host"
                    value={btForm.addStaffBtnText}
                    onChange={(e) => setBtForm({ ...btForm, addStaffBtnText: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-emerald-500 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Booking Action Button Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Reserve Room / Check-In"
                    value={btForm.bookingActionLabel}
                    onChange={(e) => setBtForm({ ...btForm, bookingActionLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-emerald-500 bg-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Slot Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 15 for Clinic, 60 for Turf, 1440 for Hotel"
                    value={btForm.defaultSlotDuration}
                    onChange={(e) => setBtForm({ ...btForm, defaultSlotDuration: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Buffer Between Slots (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5 for Clinic, 60 for Housekeeping"
                    value={btForm.defaultBookingBuffer}
                    onChange={(e) => setBtForm({ ...btForm, defaultBookingBuffer: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setBtModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingBt}
                className="px-5 py-1.5 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs"
              >
                {savingBt ? 'Saving...' : 'Save Business Profile'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}