import express from 'express';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 3600 * 1000);

// @desc    Get all actionable notifications: expiring/expired licenses,
//          unpaid/overdue invoices, expiring quotes.
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isPlatform = req.user.role === 'platform_owner';
    const now = new Date();
    const notifications = [];

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
          link: '/quotes'
        });
      } else if (daysLeft <= 14) {
        notifications.push({
          type: 'quote_expiring',
          severity: 'info',
          title: `Quotation expiring: ${q.quoteNumber}`,
          message: `Valid for ${daysLeft} more day${daysLeft === 1 ? '' : 's'} (${q.customerName || '—'}).`,
          entityId: q._id,
          link: '/quotes'
        });
      }
    });

    notifications.sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    res.json({
      notifications,
      unreadCount: notifications.length,
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