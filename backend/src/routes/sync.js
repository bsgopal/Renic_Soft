import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { dbHelper } from '../models/dbHelper.js';
import { buildCustomerBaseUrl } from '../utils/customerUrl.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const SYNC_SECRET = process.env.SYNC_SECRET_KEY || 'Renic_BiDirectional_Sync_Key_2026_Secure';

/**
 * Generate HMAC-SHA256 signature for payload
 */
function generateSignature(payload, secret = SYNC_SECRET) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify incoming HMAC-SHA256 signature
 */
function verifySignature(payload, signature, secret = SYNC_SECRET) {
  if (!signature) return false;
  try {
    const expected = generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    return false;
  }
}

// @desc    Push active license and feature entitlement to a client instance
// @route   POST /api/sync/push/:clientId
// @access  Private (Platform Owner only)
router.post('/push/:clientId', protect, authorize('platform_owner'), async (req, res) => {
  try {
    const client = await dbHelper.findById('Client', req.params.clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const payload = {
      clientId: String(client._id),
      clientName: client.name,
      customerCode: client.customerCode || client.subdomain,
      subdomain: client.subdomain || '',
      softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
      planTier: client.planTier || 'basic',
      billingCycle: client.billingCycle || '1_MONTH',
      licenseStart: client.licenseStart,
      licenseEnd: client.licenseEnd,
      licenseStatus: client.licenseStatus || 'active',
      emergencyLock: Boolean(
        client.securitySettings?.emergencyLock ||
        ['locked', 'disabled', 'suspended', 'cancelled', 'inactive', 'revoked'].includes(client.licenseStatus)
      ),
      screenPermissions: client.screenPermissions || client.featurePermissions || {},
      featurePermissions: client.screenPermissions || client.featurePermissions || {},
      whatsappSenderMode: client.whatsappSenderMode || 'DOCKER',
      dockerThrottleSeconds: client.dockerThrottleSeconds || 6,
      wahaApiUrl: client.wahaApiUrl || '',
      wahaApiKey: client.wahaApiKey || '',
      wahaSessionName: client.wahaSessionName || 'default',
      limits: client.limits || {
        maxContacts: 10000,
        maxMonthlyMessages: 50000,
        maxConcurrentSessions: 2
      },
      clientId: client.clientId || (`renic_client_${client.subdomain || 'client'}`),
      clientSecret: client.clientSecret || '',
      clientSecretHash: client.clientSecretHash || '',
      timestamp: Date.now()
    };

    const signature = generateSignature(payload, client.apiSecretKey || SYNC_SECRET);

    // Determine target URL for the client instance
    let targetUrl = client.clientInstanceUrl;
    if (!targetUrl) {
      if (process.env.NODE_ENV === 'production') {
        targetUrl = `${buildCustomerBaseUrl(client)}/api/v1/license/sync`;
      } else {
        // Local development fallback to WA_INSTA_AUTOMATION port 5000
        targetUrl = 'http://127.0.0.1:5000/api/v1/license/sync';
      }
    }

    console.log(`[Push Sync] Sending license update to: ${targetUrl}`);
    let pushResult = null;
    let pushError = null;

    try {
      const response = await axios.post(targetUrl, payload, {
        headers: {
          'x-renic-hq-signature': signature,
          'x-renic-timestamp': String(payload.timestamp),
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      pushResult = response.data;
    } catch (err) {
      pushError = err.response?.data?.message || err.message;
      console.warn(`[Push Sync Warning]: Could not deliver directly to ${targetUrl}: ${pushError}`);
    }

    // Update client sync status in DB
    const syncStatus = pushError ? 'failed' : 'synced';
    const updated = await dbHelper.findByIdAndUpdate('Client', client._id, {
      lastSyncStatus: syncStatus,
      lastSyncedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      delivered: !pushError,
      targetUrl,
      syncStatus,
      message: pushError
        ? `License saved locally. Target instance offline or unreachable (${pushError}). It will synchronize on next connect.`
        : 'License pushed and synchronized with client instance successfully!',
      client: updated,
      result: pushResult
    });
  } catch (error) {
    console.error('Push sync error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error during sync' });
  }
});

// @desc    Receive renewal payment callback from client software (Bi-directional)
// @route   POST /api/sync/payment-callback
// @access  Public (HMAC Signed)
router.post('/payment-callback', async (req, res) => {
  try {
    const signature = req.headers['x-renic-signature'];
    const {
      subdomain,
      transactionId,
      amountPaid,
      paymentMethod = 'UPI',
      selectedDuration = '1_MONTH',
      daysToAdd = 30,
      customerGst = '',
      customerEmail = '',
      customerPhone = ''
    } = req.body;

    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain is required' });
    }

    // Locate client by subdomain
    const client = await dbHelper.findOne('Client', { subdomain: subdomain.toLowerCase().trim() });
    if (!client) {
      return res.status(404).json({ success: false, message: `Client not found for subdomain: ${subdomain}` });
    }

    // Verify signature with client secret key or global secret
    const secret = client.apiSecretKey || SYNC_SECRET;
    if (signature && !verifySignature(req.body, signature, secret)) {
      console.warn(`[Payment Callback]: Invalid signature attempt for ${subdomain}`);
      return res.status(401).json({ success: false, message: 'Invalid payment webhook signature' });
    }

    // 1. Stack renewal days onto existing end date (or today if expired)
    const baseDate = new Date(client.licenseEnd) > new Date() ? new Date(client.licenseEnd) : new Date();
    baseDate.setDate(baseDate.getDate() + parseInt(daysToAdd || 30));
    const newEnd = baseDate.toISOString();

    await dbHelper.findByIdAndUpdate('Client', client._id, {
      licenseEnd: newEnd,
      licenseStatus: 'active',
      billingCycle: selectedDuration,
      lastSyncStatus: 'synced',
      lastSyncedAt: new Date().toISOString()
    });

    // 2. Automatically generate GST Tax Invoice in Bill collection
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = parseFloat(amountPaid) || 0;
    const subTotal = Math.round((totalAmount / 1.18) * 100) / 100; // Assuming 18% GST inclusive
    const taxTotal = Math.round((totalAmount - subTotal) * 100) / 100;

    let createdBill = null;
    try {
      createdBill = await dbHelper.create('Bill', {
        clientId: client._id,
        invoiceNumber,
        cashierId: client._id, // System generated
        cashierName: 'Renic Auto-Billing Engine',
        customerName: client.name,
        customerPhone: customerPhone || client.contact || client.pendingOwnerMobile,
        customerEmail: customerEmail || client.pendingOwnerEmail,
        customerAddress: client.address || '',
        customerGSTIN: customerGst || client.gstNumber || '',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        items: [
          {
            name: `Renic Automation Subscription - ${selectedDuration}`,
            description: `Renewal for ${daysToAdd} days. Valid until ${newEnd.slice(0, 10)}. Transaction Ref: ${transactionId || 'N/A'}`,
            hsnCode: '998314', // IT software services HSN
            qty: 1,
            unit: 'license',
            rate: subTotal,
            gstPercent: 18,
            discountPercent: 0,
            amount: totalAmount
          }
        ],
        subTotal,
        discountTotal: 0,
        taxTotal,
        grandTotal: totalAmount,
        amountPaid: totalAmount,
        balanceDue: 0,
        paymentMethod: paymentMethod === 'Card' ? 'Card' : paymentMethod === 'UPI' ? 'UPI' : 'Bank Transfer',
        notes: `Automated renewal via in-app payment. Gateway Ref: ${transactionId || 'DIRECT'}`,
        status: 'Paid'
      });
      console.log(`[Auto-Billing]: Generated Tax Invoice ${invoiceNumber} for ${client.name} (₹${totalAmount})`);
    } catch (billErr) {
      console.error('[Auto-Billing Error]: Could not create bill record:', billErr);
    }

    // 3. Return updated token payload
    const responsePayload = {
      success: true,
      message: `Subscription successfully extended by ${daysToAdd} days`,
      invoiceNumber: createdBill ? createdBill.invoiceNumber : invoiceNumber,
      newLicenseEnd: newEnd,
      licenseStatus: 'active',
      subdomain: client.subdomain
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal error processing payment callback' });
  }
});

// @desc    Ingest health telemetry heartbeat from client instances
// @route   POST /api/sync/heartbeat
// @access  Public (Secret verified)
router.post('/heartbeat', async (req, res) => {
  try {
    const { subdomain, whatsappStatus, monthlyMessagesSent, totalContacts, appVersion } = req.body;
    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain is required' });
    }

    const client = await dbHelper.findOne('Client', { subdomain: subdomain.toLowerCase().trim() });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not registered' });
    }

    await dbHelper.findByIdAndUpdate('Client', client._id, {
      telemetry: {
        whatsappStatus: whatsappStatus || 'unknown',
        monthlyMessagesSent: parseInt(monthlyMessagesSent || 0),
        totalContacts: parseInt(totalContacts || 0),
        lastHeartbeat: new Date().toISOString(),
        appVersion: appVersion || '1.0.0'
      }
    });

    res.json({ success: true, acknowledgedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Heartbeat ingest error:', error);
    res.status(500).json({ success: false, message: 'Heartbeat error' });
  }
});

export default router;
