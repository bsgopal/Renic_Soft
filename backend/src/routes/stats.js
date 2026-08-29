import express from 'express';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Dashboard summary statistics
// @route   GET /api/stats/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const isPlatform = req.user.role === 'platform_owner';

    const clients = isPlatform ? await dbHelper.find('Client', {}) : (req.user.clientId ? [await dbHelper.findById('Client', req.user.clientId)] : []);
    const quotes = isPlatform ? await dbHelper.find('Quotation', {}) : await dbHelper.find('Quotation', { clientId: req.user.clientId });
    const bills = isPlatform ? await dbHelper.find('Bill', {}) : await dbHelper.find('Bill', { clientId: req.user.clientId });

    const now = new Date();
    const activeClients = clients.filter((c) => c.licenseStatus === 'active' && new Date(c.licenseEnd) > now).length;
    const expiringSoon = clients.filter((c) => {
      const end = new Date(c.licenseEnd);
      return end > now && end < new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    }).length;
    const lockedClients = clients.filter((c) => c.licenseStatus === 'locked' || c.licenseStatus === 'cancelled').length;

    const revenue = bills.filter((b) => b.status === 'Paid').reduce((s, b) => s + (b.grandTotal || 0), 0);
    const pendingRevenue = bills.filter((b) => b.balanceDue > 0).reduce((s, b) => s + (b.balanceDue || 0), 0);

    res.json({
      totalClients: clients.length,
      activeClients,
      expiringSoon,
      lockedClients,
      totalQuotes: quotes.length,
      acceptedQuotes: quotes.filter((q) => q.status === 'accepted' || q.status === 'converted').length,
      totalBills: bills.length,
      paidBills: bills.filter((b) => b.status === 'Paid').length,
      revenue,
      pendingRevenue,
      recentQuotes: quotes.slice(0, 5),
      recentBills: bills.slice(0, 5)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Error retrieving statistics' });
  }
});

export default router;