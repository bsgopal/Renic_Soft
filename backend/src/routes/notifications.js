import express from 'express';
import { dbHelper } from '../models/dbHelper.js';
import TenantActivityLog from '../models/TenantActivityLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Track in-memory or persisted dismissed notification IDs
let dismissedNotificationIds = new Set();

// @desc    Get all actionable notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isPlatform = req.user.role === 'platform_owner' || req.user.role === 'admin';
    const now = new Date();
    const notifications = [];

    // ---- Security Alerts (Critical High Priority) ----
    const alertFilter = { actionType: 'SECURITY_ALERT' };
    if (!isPlatform && req.user.clientId) {
      const userClient = await dbHelper.findById('Client', req.user.clientId);
      if (userClient?.customerCode) {
        alertFilter.customerCode = { $in: [userClient.customerCode.toLowerCase(), userClient.customerCode.toUpperCase()] };
      }
    }
    const securityAlerts = await TenantActivityLog.find(alertFilter)
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(50)
      .lean();

    securityAlerts.forEach((alert) => {
      const id = `sec_${alert._id}`;
      if (dismissedNotificationIds.has(id)) return;

      const clientLabel = alert.clientName 
        ? `${alert.clientName} (${alert.customerCode || 'Store'})`
        : (alert.customerCode || 'Store');

      notifications.push({
        id,
        type: 'security_alert',
        severity: 'critical',
        title: `🚨 Unauthorized OAuth Attempt: ${clientLabel}`,
        message: alert.actionDescription || `Unauthorized attempt to authenticate using credentials for ${clientLabel}.`,
        entityId: alert._id,
        link: '/credentials',
        timestamp: alert.timestamp || alert.createdAt
      });
    });

    // ---- Licenses ----
    const clients = isPlatform ? await dbHelper.find('Client', {}) : (req.user.clientId ? [await dbHelper.findById('Client', req.user.clientId)] : []);
    clients.forEach((c) => {
      if (!c) return;
      const end = new Date(c.licenseEnd);
      const daysLeft = Math.ceil((end - now) / (24 * 3600 * 1000));

      if (daysLeft < 0 && c.licenseStatus === 'active') {
        const id = `lic_exp_${c._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'license_expired',
            severity: 'error',
            title: `License expired: ${c.name}`,
            message: `Store license expired ${Math.abs(daysLeft)} days ago.`,
            entityId: c._id,
            link: '/licenses',
            timestamp: c.updatedAt || c.createdAt
          });
        }
      } else if (daysLeft <= 30 && daysLeft >= 0 && c.licenseStatus === 'active') {
        const id = `lic_warn_${c._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'license_expiring',
            severity: daysLeft <= 7 ? 'warning' : 'info',
            title: `License expiring soon: ${c.name}`,
            message: `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining (${end.toLocaleDateString()}).`,
            entityId: c._id,
            link: '/licenses',
            timestamp: c.updatedAt || c.createdAt
          });
        }
      } else if (c.licenseStatus === 'locked' || c.licenseStatus === 'cancelled') {
        const id = `lic_lock_${c._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'license_locked',
            severity: 'error',
            title: `License ${c.licenseStatus}: ${c.name}`,
            message: `Store access is blocked for ${c.name}.`,
            entityId: c._id,
            link: '/licenses',
            timestamp: c.updatedAt || c.createdAt
          });
        }
      }
    });

    // ---- Invoices ----
    const bills = isPlatform ? await dbHelper.find('Bill', {}) : await dbHelper.find('Bill', { clientId: req.user.clientId });
    bills.forEach((b) => {
      const due = (b.balanceDue || 0);
      if (due > 0 && b.status !== 'Cancelled') {
        const overdue = b.dueDate && new Date(b.dueDate) < now;
        const id = `bill_${b._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'payment_unpaid',
            severity: overdue ? 'error' : 'warning',
            title: `Payment ${overdue ? 'overdue' : 'pending'}: ${b.invoiceNumber}`,
            message: `${b.customerName || 'Customer'} owes ${due.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}${overdue ? ' (past due date)' : ''}.`,
            entityId: b._id,
            link: '/billing',
            timestamp: b.dueDate || b.createdAt
          });
        }
      }
    });

    // ---- Quotations expiring ----
    const quotes = isPlatform ? await dbHelper.find('Quotation', {}) : await dbHelper.find('Quotation', { clientId: req.user.clientId });
    quotes.forEach((q) => {
      if (!q.validUntil || q.status === 'converted' || q.status === 'rejected' || q.status === 'expired') return;
      const end = new Date(q.validUntil);
      const daysLeft = Math.ceil((end - now) / (24 * 3600 * 1000));
      if (daysLeft < 0) {
        const id = `quote_exp_${q._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'quote_expired',
            severity: 'info',
            title: `Quotation expired: ${q.quoteNumber}`,
            message: (q.customerName || 'Customer') + ' — validity ended on ' + end.toLocaleDateString(),
            entityId: q._id,
            link: '/quotes',
            timestamp: q.updatedAt || q.createdAt
          });
        }
      } else if (daysLeft <= 14) {
        const id = `quote_warn_${q._id}`;
        if (!dismissedNotificationIds.has(id)) {
          notifications.push({
            id,
            type: 'quote_expiring',
            severity: 'info',
            title: `Quotation expiring: ${q.quoteNumber}`,
            message: `Valid for ${daysLeft} more day${daysLeft === 1 ? '' : 's'} (${q.customerName || '—'}).`,
            entityId: q._id,
            link: '/quotes',
            timestamp: q.updatedAt || q.createdAt
          });
        }
      }
    });

    // ---- Application Sync & PaaS Events ----
    try {
      const ApplicationSyncLog = (await import('../models/ApplicationSyncLog.js')).default;
      const syncLogs = await ApplicationSyncLog.find({})
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(10)
        .lean();

      syncLogs.forEach((log) => {
        const id = `sync_${log._id}`;
        if (dismissedNotificationIds.has(id)) return;

        const isSuccess = log.status === 'SUCCESS' || log.status === 'ACTIVE' || !log.error;
        notifications.push({
          id,
          type: 'app_sync',
          severity: isSuccess ? 'info' : 'warning',
          title: `App Sync: ${log.appName || 'PaaS Hub'}`,
          message: log.details || log.action || 'Application synchronization completed successfully.',
          entityId: log._id,
          link: '/applications',
          timestamp: log.timestamp || log.createdAt
        });
      });
    } catch (e) {
      /* skip */
    }

    notifications.sort((a, b) => {
      const order = { critical: 0, error: 1, warning: 2, info: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    res.json({
      notifications,
      unreadCount: notifications.length,
      securityAlerts: notifications.filter((n) => n.type === 'security_alert').length,
      expiredLicenses: notifications.filter((n) => n.type === 'license_expired').length,
      expiringLicenses: notifications.filter((n) => n.type === 'license_expiring').length,
      unpaidInvoices: notifications.filter((n) => n.type === 'payment_unpaid').length
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ message: 'Error retrieving notifications' });
  }
});

// @desc    Delete single notification by ID
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    dismissedNotificationIds.add(id);

    // If it's a security alert, remove the underlying log
    if (id.startsWith('sec_')) {
      const logId = id.replace('sec_', '');
      try {
        await TenantActivityLog.findByIdAndDelete(logId);
      } catch (e) { /* silent */ }
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear/all
// @access  Private
router.delete('/clear/all', protect, async (req, res) => {
  try {
    // Clear all security logs if platform admin
    if (req.user.role === 'platform_owner' || req.user.role === 'admin') {
      try {
        await TenantActivityLog.deleteMany({ actionType: 'SECURITY_ALERT' });
      } catch (e) { /* silent */ }
    }
    dismissedNotificationIds.clear();
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;