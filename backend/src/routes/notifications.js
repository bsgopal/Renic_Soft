import express from 'express';
import { dbHelper } from '../models/dbHelper.js';
import TenantActivityLog from '../models/TenantActivityLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 3600 * 1000);

// @desc    Get all actionable notifications: security alerts, expiring/expired licenses,
//          unpaid/overdue invoices, expiring quotes.
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isPlatform = req.user.role === 'platform_owner';
    const now = new Date();
    const notifications = [];

    // ---- Security Alerts (Critical High Priority) ----
    const alertFilter = { actionType: 'SECURITY_ALERT' };
    if (!isPlatform && req.user.clientId) {
      const userClient = await dbHelper.findById('Client', req.user.clientId);
      if (userClient?.customerCode) {
        alertFilter.customerCode = userClient.customerCode;
      }
    }
    const securityAlerts = await TenantActivityLog.find(alertFilter)
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(25)
      .lean();

    securityAlerts.forEach((alert) => {
      notifications.push({
        type: 'security_alert',
        severity: 'critical',
        title: `🚨 Unauthorized OAuth Attempt: ${alert.customerCode || 'Store'}`,
        message: alert.actionDescription || 'Unauthorized attempt to authenticate using customer credentials.',
        entityId: alert._id,
        link: '/audit-logs',
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
        notifications.push({
          type: 'license_expired',
          severity: 'error',
          title: `License expired: ${c.name}`,
          message: `Store license expired ${Math.abs(daysLeft)} days ago.`,
          entityId: c._id,
          link: '/licenses'
        });
      } else if (daysLeft <= 30 && daysLeft >= 0 && c.licenseStatus === 'active') {
        notifications.push({
          type: 'license_expiring',
          severity: daysLeft <= 7 ? 'warning' : 'info',
          title: `License expiring soon: ${c.name}`,
          message: `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining (${end.toLocaleDateString()}).`,
          linkId: c._id,
          link: '/licenses'
        });
      } else if (c.licenseStatus === 'locked' || c.licenseStatus === 'cancelled') {
        notifications.push({
          type: 'license_locked',
          severity: 'error',
          title: `License ${c.licenseStatus}: ${c.name}`,
          message: `Store access is blocked for ${c.name}.`,
          entityId: c._id,
          link: '/licenses'
        });
      }
    });

    // ---- Invoices ----
    const bills = isPlatform ? await dbHelper.find('Bill', {}) : await dbHelper.find('Bill', { clientId: req.user.clientId });
    bills.forEach((b) => {
      const due = (b.balanceDue || 0);
      if (due > 0 && b.status !== 'Cancelled') {
        const overdue = b.dueDate && new Date(b.dueDate) < now;
        notifications.push({
          type: 'payment_unpaid',
          severity: overdue ? 'error' : 'warning',
          title: `Payment ${overdue ? 'overdue' : 'pending'}: ${b.invoiceNumber}`,
          message: `${b.customerName || 'Customer'} owes ${due.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}${overdue ? ' (past due date)' : ''}.`,
          entityId: b._id,
          link: '/reports'
        });
      }
    });

    // ---- Quotations expiring ----
    const quotes = isPlatform ? await dbHelper.find('Quotation', {}) : await dbHelper.find('Quotation', { clientId: req.user.clientId });
    quotes.forEach((q) => {
      if (!q.validUntil || q.status === 'converted' || q.status === 'rejected' || q.status === 'expired') return;
      const end = new Date(q.validUntil);
      const daysLeft = Math.ceil((end - now) / (24 * 3600 * 1000));
      if (daysLeft < 0) {
        notifications.push({
          type: 'quote_expired',
          severity: 'info',
          title: `Quotation expired: ${q.quoteNumber}`,
          message: q.customerName || 'Customer' + ' — validity ended on ' + end.toLocaleDateString(),
          entityId: q._id,
          link: '/quotes',
          timestamp: q.updatedAt || q.createdAt
        });
      } else if (daysLeft <= 14) {
        notifications.push({
          type: 'quote_expiring',
          severity: 'info',
          title: `Quotation expiring: ${q.quoteNumber}`,
          message: `Valid for ${daysLeft} more day${daysLeft === 1 ? '' : 's'} (${q.customerName || '—'}).`,
          entityId: q._id,
          link: '/quotes',
          timestamp: q.updatedAt || q.createdAt
        });
      }
    });

    // ---- Application Sync & PaaS Events (Success / Info) ----
    try {
      const ApplicationSyncLog = (await import('../models/ApplicationSyncLog.js')).default;
      const syncLogs = await ApplicationSyncLog.find({})
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(10)
        .lean();

      syncLogs.forEach((log) => {
        const isSuccess = log.status === 'SUCCESS' || log.status === 'ACTIVE' || !log.error;
        notifications.push({
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
      /* skip if model not populated */
    }

    // ---- Recent Successful Invoices / Payments (Success / Info) ----
    try {
      const paidBills = isPlatform
        ? await dbHelper.find('Bill', { status: 'Paid' })
        : await dbHelper.find('Bill', { clientId: req.user.clientId, status: 'Paid' });

      (paidBills || []).slice(0, 5).forEach((b) => {
        notifications.push({
          type: 'payment_received',
          severity: 'info',
          title: `Payment Received: ${b.invoiceNumber || 'INV'}`,
          message: `${b.customerName || 'Client'} paid ${(b.totalAmount || b.paidAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
          entityId: b._id,
          link: '/billing',
          timestamp: b.updatedAt || b.createdAt
        });
      });
    } catch (e) {
      /* skip */
    }

    // ---- Active Clients & Live Stores ----
    const activeClients = clients.filter(c => c && c.licenseStatus === 'active');
    activeClients.slice(0, 5).forEach((c) => {
      notifications.push({
        type: 'store_live',
        severity: 'info',
        title: `Live Store Active: ${c.name}`,
        message: `Plan: ${c.planType || 'Enterprise'} • Code: ${c.customerCode || 'RN'}`,
        entityId: c._id,
        link: '/licenses',
        timestamp: c.updatedAt || c.createdAt
      });
    });

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

export default router;