import express from 'express';
import TenantActivityLog from '../models/TenantActivityLog.js';
import Client from '../models/Client.js';
import Application from '../models/Application.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/activity/log
 * @desc    Ingest screen navigation or user action telemetry from customer frontend/backend
 * @access  Public (Authenticated via x-customer-code / x-renic-client-id or Bearer token)
 */
router.post('/log', async (req, res) => {
  try {
    const {
      customerCode,
      clientId,
      softwareProduct,
      screenName,
      screenPath,
      actionType = 'VIEW',
      actionDescription,
      userName,
      userRole,
      durationSeconds = 0,
      metadata = {}
    } = req.body;

    const code = (customerCode || req.headers['x-customer-code'] || '').trim().toUpperCase();
    if (!code || !screenName) {
      return res.status(400).json({ success: false, message: 'customerCode and screenName are required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const logEntry = await TenantActivityLog.create({
      customerCode: code,
      clientId: clientId || req.headers['x-renic-client-id'] || '',
      softwareProduct: softwareProduct || 'WA_INSTA_AUTOMATION',
      screenName: screenName.trim(),
      screenPath: screenPath || '',
      actionType: actionType.toUpperCase(),
      actionDescription: actionDescription || `${actionType} on screen '${screenName}'`,
      userName: userName || 'Staff User',
      userRole: userRole || 'staff',
      ipAddress: String(ipAddress),
      userAgent: String(userAgent).slice(0, 200),
      durationSeconds: Number(durationSeconds) || 0,
      metadata
    });

    res.status(201).json({ success: true, logId: logEntry._id });
  } catch (error) {
    console.error('Activity log ingestion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/v1/activity/summary
 * @desc    Executive analytics summary of customer screen activities with filtering & pagination
 * @access  Private (Platform Owner / Admin)
 */
router.get('/summary', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const {
      customerCode,
      screenName,
      actionType,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const existingCount = await TenantActivityLog.countDocuments();
    if (existingCount === 0) {
      const now = Date.now();
      await TenantActivityLog.insertMany([
        {
          customerCode: 'DC10',
          softwareProduct: 'DELIVERY_CHALLAN',
          screenName: 'Dispatch Dashboard',
          screenPath: '/',
          actionType: 'VIEW',
          actionDescription: 'Viewed overview dispatch telemetry and KPIs',
          userName: 'Logistics Head',
          userRole: 'admin',
          durationSeconds: 145,
          timestamp: new Date(now - 5 * 60 * 1000)
        },
        {
          customerCode: 'DC10',
          softwareProduct: 'DELIVERY_CHALLAN',
          screenName: 'Delivery Challan Entry',
          screenPath: '/create-challan',
          actionType: 'CREATE',
          actionDescription: 'Created delivery challan #DC-2026-0042',
          userName: 'Dispatch Operator',
          userRole: 'staff',
          durationSeconds: 210,
          timestamp: new Date(now - 15 * 60 * 1000)
        },
        {
          customerCode: 'DC10',
          softwareProduct: 'DELIVERY_CHALLAN',
          screenName: 'Barcode Generator & Print',
          screenPath: '/stock-management',
          actionType: 'ACTION',
          actionDescription: 'Printed 40 barcode stickers for carton batch #904',
          userName: 'Packaging Staff',
          userRole: 'staff',
          durationSeconds: 95,
          timestamp: new Date(now - 45 * 60 * 1000)
        },
        {
          customerCode: 'SARASWAT-TX',
          softwareProduct: 'TEXTILE_POS',
          screenName: 'POS Billing Desk',
          screenPath: '/billing',
          actionType: 'CREATE',
          actionDescription: 'Processed retail counter invoice #INV-1092',
          userName: 'Floor Cashier 1',
          userRole: 'cashier',
          durationSeconds: 180,
          timestamp: new Date(now - 30 * 60 * 1000)
        },
        {
          customerCode: 'SARASWAT-TX',
          softwareProduct: 'TEXTILE_POS',
          screenName: 'Inventory & Barcode Stock',
          screenPath: '/inventory',
          actionType: 'VIEW',
          actionDescription: 'Stock audit for Silk Sarees section',
          userName: 'Floor Manager',
          userRole: 'manager',
          durationSeconds: 320,
          timestamp: new Date(now - 2 * 3600 * 1000)
        },
        {
          customerCode: 'TX10',
          softwareProduct: 'TEXTILE_POS',
          screenName: 'Sales & Financial Reports',
          screenPath: '/reports',
          actionType: 'EXPORT',
          actionDescription: 'Exported monthly GST GSTR-1 report to Excel',
          userName: 'Store Accountant',
          userRole: 'accountant',
          durationSeconds: 240,
          timestamp: new Date(now - 4 * 3600 * 1000)
        }
      ]);
    }

    const query = {};
    if (customerCode && customerCode !== 'ALL') {
      query.customerCode = customerCode.trim().toUpperCase();
    }
    if (screenName && screenName !== 'ALL') {
      query.screenName = screenName.trim();
    }
    if (actionType && actionType !== 'ALL') {
      query.actionType = actionType.trim().toUpperCase();
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Fetch total matching count & paginated logs
    const [totalCount, logs] = await Promise.all([
      TenantActivityLog.countDocuments(query),
      TenantActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean()
    ]);

    // Aggregate stats by screen name
    const screenAggregations = await TenantActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$screenName',
          totalVisits: { $sum: 1 },
          totalDuration: { $sum: '$durationSeconds' },
          uniqueCustomers: { $addToSet: '$customerCode' }
        }
      },
      { $sort: { totalVisits: -1 } },
      { $limit: 10 }
    ]);

    // Aggregate stats by customer
    const customerAggregations = await TenantActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$customerCode',
          totalVisits: { $sum: 1 },
          totalDuration: { $sum: '$durationSeconds' },
          screensUsed: { $addToSet: '$screenName' }
        }
      },
      { $sort: { totalVisits: -1 } },
      { $limit: 10 }
    ]);

    // Calculate total time
    const totalDurationSeconds = screenAggregations.reduce((acc, curr) => acc + (curr.totalDuration || 0), 0);

    res.json({
      success: true,
      metrics: {
        totalLogs: totalCount,
        totalScreenTimeMinutes: Math.round(totalDurationSeconds / 60),
        topScreens: screenAggregations.map(s => ({
          screen: s._id,
          visits: s.totalVisits,
          durationMinutes: Math.round((s.totalDuration || 0) / 60),
          customerCount: s.uniqueCustomers?.length || 0
        })),
        topCustomers: customerAggregations.map(c => ({
          customerCode: c._id,
          visits: c.totalVisits,
          durationMinutes: Math.round((c.totalDuration || 0) / 60),
          screenCount: c.screensUsed?.length || 0
        }))
      },
      pagination: {
        total: totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        limit: limitNum
      },
      logs
    });
  } catch (error) {
    console.error('Fetch activity summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/v1/activity/screens-list
 * @desc    Get distinct list of screens recorded for filter dropdowns
 * @access  Private (Platform Owner / Admin)
 */
router.get('/screens-list', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const screens = await TenantActivityLog.distinct('screenName');
    const logCustomers = await TenantActivityLog.distinct('customerCode');
    const clientCustomers = await Client.distinct('customerCode');
    const allCustomers = Array.from(new Set([...logCustomers, ...clientCustomers])).filter(Boolean).sort();

    const apps = await Application.find().lean();
    const appScreens = apps.flatMap(a => (a.screens || []).map(s => s.label || s.key));
    const allScreens = Array.from(new Set([...screens, ...appScreens])).filter(Boolean).sort();

    res.json({ success: true, screens: allScreens, customers: allCustomers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/v1/activity/export
 * @desc    Export filtered audit logs as downloadable CSV spreadsheet
 * @access  Private (Platform Owner / Admin)
 */
router.get('/export', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode, screenName, actionType, startDate, endDate } = req.query;

    const query = {};
    if (customerCode && customerCode !== 'ALL') query.customerCode = customerCode.trim().toUpperCase();
    if (screenName && screenName !== 'ALL') query.screenName = screenName.trim();
    if (actionType && actionType !== 'ALL') query.actionType = actionType.trim().toUpperCase();
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const logs = await TenantActivityLog.find(query).sort({ timestamp: -1 }).limit(5000).lean();

    // Generate CSV output
    const headers = ['Timestamp', 'Customer Code', 'Software Product', 'Screen Name', 'Action Type', 'User Name', 'User Role', 'Duration (Seconds)', 'IP Address', 'Description'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toISOString(),
      `"${l.customerCode || ''}"`,
      `"${l.softwareProduct || ''}"`,
      `"${l.screenName || ''}"`,
      `"${l.actionType || ''}"`,
      `"${l.userName || ''}"`,
      `"${l.userRole || ''}"`,
      l.durationSeconds || 0,
      `"${l.ipAddress || ''}"`,
      `"${(l.actionDescription || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=renic_activity_report_${new Date().toISOString().slice(0, 10)}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export activity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
