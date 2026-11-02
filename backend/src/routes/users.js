import express from 'express';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

export const SYSTEM_MODULES = [
  { path: '/', label: 'Dashboard', key: 'dashboard', description: 'Overview metrics and quick actions' },
  { path: '/licenses', label: 'Licenses & Fleet', key: 'licenses', description: 'Customer licenses and subscriptions' },
  { path: '/plan-tiers', label: 'Plan Tiers & Screens', key: 'plan_tiers', description: 'Pricing plans and screen assignments' },
  { path: '/applications', label: 'Applications (PaaS)', key: 'applications', description: 'Multi-app repository & solutions' },
  { path: '/deployments', label: 'Deployments', key: 'deployments', description: 'Deployment status and git triggers' },
  { path: '/credentials', label: 'API & OAuth Hub', key: 'credentials', description: 'OAuth & API keys management' },
  { path: '/activity-report', label: 'Screen Audit', key: 'activity_report', description: 'Tenant live activity reports' },
  { path: '/network', label: 'Customer URLs', key: 'network', description: 'Domain & host network manager' },
  { path: '/quotes', label: 'Quotations', key: 'quotes', description: 'Quotation builder and estimates' },
  { path: '/billing', label: 'Billing & Invoices', key: 'billing', description: 'Invoices and payment receipts' },
  { path: '/reports', label: 'Payment Reports', key: 'reports', description: 'Financial & payment audit records' },
  { path: '/notifications', label: 'Notifications', key: 'notifications', description: 'System alerts and updates' },
  { path: '/settings', label: 'Company Settings', key: 'settings', description: 'Company profile and defaults' }
];

export const isUserSuperAdmin = (user) => {
  if (!user) return false;
  return (
    user.role === 'platform_owner' ||
    user.role === 'super_admin' ||
    String(user.mobile).trim() === '9345578103' ||
    (user.email && String(user.email).toLowerCase().trim() === 'bsgopal0@gmail.com')
  );
};

// Guard: Only Super Admin can perform user management operations
const requireSuperAdmin = (req, res, next) => {
  if (!isUserSuperAdmin(req.user)) {
    return res.status(403).json({
      message: 'Access denied: Only Super Admin can create or manage users and assign page access'
    });
  }
  next();
};

const getAssignableApps = async () => {
  const rawApps = await dbHelper.find('Application', {});
  return (rawApps || [])
    .filter(a => a.assignable !== false)
    .map(a => ({
      name: a.name,
      appCode: a.appCode,
      urlSlug: a.urlSlug,
      category: a.category || 'General',
      icon: a.icon || 'Layers'
    }));
};

// @desc    Get all available system modules / pages for permission assignment
// @route   GET /api/users/modules
// @access  Private (Super Admin only)
router.get('/modules', protect, requireSuperAdmin, async (req, res) => {
  const applications = await getAssignableApps();
  res.json({ modules: SYSTEM_MODULES, applications });
});

// @desc    List all users with their roles, allowed pages, and assigned apps
// @route   GET /api/users
// @access  Private (Super Admin only)
router.get('/', protect, requireSuperAdmin, async (req, res) => {
  try {
    const [rawUsers, applications] = await Promise.all([
      dbHelper.find('User', {}),
      getAssignableApps()
    ]);

    const users = (rawUsers || []).map((u) => {
      const isSuper = isUserSuperAdmin(u);
      const isClient = u.role === 'client' || u.role === 'client_admin';
      return {
        _id: u._id,
        name: u.name,
        mobile: u.mobile,
        email: u.email || '',
        role: isSuper ? 'platform_owner' : (u.role || 'admin'),
        roleLabel: isSuper ? 'Super Admin' : isClient ? 'Client' : 'Admin',
        userCategory: isClient ? 'EXTERNAL_CLIENT' : 'INTERNAL_USER',
        allowedPages: isSuper ? SYSTEM_MODULES.map(m => m.path) : (u.allowedPages || []),
        assignedApplications: isSuper ? applications.map(a => a.appCode) : (u.assignedApplications || []),
        clientAppCode: u.clientAppCode || '',
        isActive: u.isActive !== false,
        clientId: u.clientId || null,
        isPermanentSuperAdmin: String(u.mobile).trim() === '9345578103',
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    });

    res.json({ users, modules: SYSTEM_MODULES, applications });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ message: 'Failed to retrieve users', error: err.message });
  }
});

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (Super Admin only)
router.post('/', protect, requireSuperAdmin, async (req, res) => {
  try {
    let { name, mobile, email, password, role, allowedPages, assignedApplications, clientAppCode, clientId } = req.body;

    name = (name || '').trim();
    mobile = (mobile || '').trim();
    email = (email || '').trim().toLowerCase();
    password = (password || '').trim();
    role = (role || 'admin').trim();
    clientAppCode = (clientAppCode || '').trim();

    if (!name) return res.status(400).json({ message: 'User name is required' });
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'A valid 10-digit mobile number is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Role mapping
    let normalizedRole = 'admin';
    if (role === 'platform_owner' || role === 'super_admin' || role === 'Super Admin') {
      normalizedRole = 'platform_owner';
    } else if (role === 'client' || role === 'client_admin' || role === 'Client') {
      normalizedRole = 'client';
    } else {
      normalizedRole = 'admin';
    }

    // Check if user already exists
    const existing = await dbHelper.findOne('User', {
      $or: [
        { mobile },
        ...(email ? [{ email }] : [])
      ]
    });

    if (existing) {
      return res.status(400).json({ message: 'A user with this mobile number or email already exists' });
    }

    const applications = await getAssignableApps();

    // If super admin, auto-assign all pages and all applications
    let pagesToAssign = Array.isArray(allowedPages) ? allowedPages : [];
    let appsToAssign = Array.isArray(assignedApplications) ? assignedApplications : [];

    if (normalizedRole === 'platform_owner') {
      pagesToAssign = SYSTEM_MODULES.map(m => m.path);
      appsToAssign = applications.map(a => a.appCode);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await dbHelper.create('User', {
      name,
      mobile,
      email,
      password: hashedPassword,
      role: normalizedRole,
      allowedPages: pagesToAssign,
      assignedApplications: appsToAssign,
      clientAppCode: normalizedRole === 'client' ? clientAppCode : '',
      clientId: clientId || null,
      isActive: true,
      permissions: {
        create_product: true,
        edit_prices: true,
        view_reports: true,
        approve_returns: true,
        access_suppliers: true
      }
    });

    res.status(201).json({
      success: true,
      message: `User '${name}' created successfully as ${normalizedRole === 'platform_owner' ? 'Super Admin' : normalizedRole === 'client' ? 'Client' : 'Admin'}`,
      user: {
        _id: newUser._id,
        name: newUser.name,
        mobile: newUser.mobile,
        email: newUser.email,
        role: newUser.role,
        allowedPages: newUser.allowedPages,
        assignedApplications: newUser.assignedApplications,
        clientAppCode: newUser.clientAppCode,
        isActive: newUser.isActive
      }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Failed to create user', error: err.message });
  }
});

// @desc    Update an existing user
// @route   PUT /api/users/:id
// @access  Private (Super Admin only)
router.put('/:id', protect, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { name, mobile, email, password, role, allowedPages, assignedApplications, clientAppCode, isActive, clientId } = req.body;

    const existing = await dbHelper.findById('User', id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isTargetPermanentSuper = String(existing.mobile).trim() === '9345578103';

    // Safeguard: Primary Super Admin (9345578103) cannot be demoted or deactivated
    if (isTargetPermanentSuper) {
      if (isActive === false) {
        return res.status(400).json({ message: 'Primary Super Admin (9345578103) cannot be deactivated' });
      }
      if (role && role !== 'platform_owner' && role !== 'super_admin') {
        return res.status(400).json({ message: 'Primary Super Admin role cannot be changed' });
      }
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (email !== undefined) updates.email = (email || '').trim().toLowerCase();

    if (mobile && mobile.trim() !== existing.mobile) {
      if (isTargetPermanentSuper) {
        return res.status(400).json({ message: 'Primary Super Admin mobile number cannot be altered' });
      }
      const newMobile = mobile.trim();
      if (!/^\d{10}$/.test(newMobile)) {
        return res.status(400).json({ message: 'Mobile must be a valid 10-digit number' });
      }
      const duplicate = await dbHelper.findOne('User', { mobile: newMobile });
      if (duplicate && String(duplicate._id) !== String(id)) {
        return res.status(400).json({ message: 'Another user already uses this mobile number' });
      }
      updates.mobile = newMobile;
    }

    if (role && !isTargetPermanentSuper) {
      let normalizedRole = 'admin';
      if (role === 'platform_owner' || role === 'super_admin') normalizedRole = 'platform_owner';
      else if (role === 'client' || role === 'client_admin') normalizedRole = 'client';
      else normalizedRole = 'admin';
      updates.role = normalizedRole;
    }

    const targetRole = updates.role || existing.role;

    if (allowedPages !== undefined) {
      if (isTargetPermanentSuper || targetRole === 'platform_owner') {
        updates.allowedPages = SYSTEM_MODULES.map(m => m.path);
      } else {
        updates.allowedPages = Array.isArray(allowedPages) ? allowedPages : [];
      }
    }

    if (assignedApplications !== undefined) {
      if (isTargetPermanentSuper || targetRole === 'platform_owner') {
        const applications = await getAssignableApps();
        updates.assignedApplications = applications.map(a => a.appCode);
      } else {
        updates.assignedApplications = Array.isArray(assignedApplications) ? assignedApplications : [];
      }
    }

    if (clientAppCode !== undefined) {
      updates.clientAppCode = (clientAppCode || '').trim();
    }

    if (isActive !== undefined && !isTargetPermanentSuper) {
      updates.isActive = Boolean(isActive);
    }

    if (clientId !== undefined) {
      updates.clientId = clientId || null;
    }

    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password.trim(), salt);
    }

    const updated = await dbHelper.findByIdAndUpdate('User', id, updates);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        _id: updated._id,
        name: updated.name,
        mobile: updated.mobile,
        email: updated.email,
        role: updated.role,
        allowedPages: updated.allowedPages,
        assignedApplications: updated.assignedApplications,
        clientAppCode: updated.clientAppCode,
        isActive: updated.isActive
      }
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private (Super Admin only)
router.delete('/:id', protect, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await dbHelper.findById('User', id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(existing.mobile).trim() === '9345578103') {
      return res.status(400).json({ message: 'Primary Super Admin (9345578103) cannot be deleted' });
    }

    if (String(existing._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete your own logged-in account' });
    }

    await dbHelper.deleteById('User', id);
    res.json({ success: true, message: `User '${existing.name}' deleted successfully` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
});

export default router;
