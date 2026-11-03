import express from 'express';
import Client from '../models/Client.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Bill from '../models/Bill.js';
import { backendPortFor } from '../config/appPorts.js';
import axios from 'axios';

const router = express.Router();

const formatIstTimestamp = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const syncToTenant = async (client) => {
  if (!client) return;
  const backendPort = backendPortFor(client.softwareProduct || 'WA_INSTA_AUTOMATION');
  if (!backendPort) return;
  try {
    const rate = Number(client.wallet?.messageRate || 0.90);
    const balance = Number(client.wallet?.balance || 0);
    const availableCredits = rate > 0 ? Math.floor(balance / rate) : 0;
    const allowWithoutBalance = !!client.wallet?.allowWithoutBalance;

    const payload = {
      clientName: client.name,
      customerCode: client.customerCode,
      subdomain: client.subdomain || client.shopSlug || '',
      whatsappSenderMode: client.whatsappSenderMode || 'DOCKER',
      walletBalance: balance,
      messageRate: rate,
      availableCredits: availableCredits,
      allowWithoutBalance: allowWithoutBalance,
      lowBalanceThreshold: client.wallet?.lowBalanceThreshold || 200,
      timestamp: Date.now()
    };

    await axios.post(`http://localhost:${backendPort}/api/v1/license/sync`, payload, { timeout: 3000 }).catch(() => {});
    await axios.post(`http://localhost:${backendPort}/api/tenant/sync-push`, payload, { timeout: 3000 }).catch(() => {});
    console.log(`[Wallet OTA Push] Synced wallet for '${client.name}' (Bal: Rs ${balance}, Rate: ${rate}, Credits: ${availableCredits}, Bypass: ${allowWithoutBalance}) to port ${backendPort}`);
  } catch (err) {}
};

const isSuperAdminUser = (user) => {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const mobile = String(user.mobile || user.phone || '');
  return role === 'SUPER_ADMIN' || role === 'SUPER ADMIN' || mobile.includes('9345578103');
};

router.get('/overview', async (req, res) => {
  try {
    const clients = await Client.find({
      $or: [
        { softwareProduct: 'WA_INSTA_AUTOMATION' },
        { 'wallet.balance': { $gt: 0 } },
        { 'wallet.totalRecharged': { $gt: 0 } }
      ]
    }).select('name customerCode wallet licenseStatus');

    let totalBalance = 0;
    let totalRecharged = 0;
    let totalSpent = 0;
    let totalMessagesSent = 0;
    let totalClientsWithBypass = 0;

    clients.forEach((c) => {
      const w = c.wallet || {};
      totalBalance += Number(w.balance || 0);
      totalRecharged += Number(w.totalRecharged || 0);
      totalSpent += Number(w.totalSpent || 0);
      totalMessagesSent += Number(w.totalMessagesSent || 0);
      if (w.allowWithoutBalance) totalClientsWithBypass++;
    });

    res.json({
      success: true,
      summary: {
        totalBalance: Number(totalBalance.toFixed(2)),
        totalRecharged: Number(totalRecharged.toFixed(2)),
        totalSpent: Number(totalSpent.toFixed(2)),
        totalMessagesSent,
        totalClientsTracked: clients.length,
        totalClientsWithBypass
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:clientId/ledger', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const { type, startDate, endDate, search, page = 1, limit = 50 } = req.query;
    const query = { clientId: client._id };

    if (type && type !== 'ALL') {
      query.transactionType = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { referenceId: regex },
        { description: regex },
        { 'performedBy.name': regex },
        { 'performedBy.mobile': regex }
      ];
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [transactions, totalCount] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WalletTransaction.countDocuments(query)
    ]);

    const balance = Number(client.wallet?.balance || 0);
    const rate = Number(client.wallet?.messageRate || 0.90);
    const availableCredits = rate > 0 ? Math.floor(balance / rate) : 0;

    res.json({
      success: true,
      wallet: {
        balance: Number(balance.toFixed(2)),
        messageRate: rate,
        availableCredits,
        allowWithoutBalance: !!client.wallet?.allowWithoutBalance,
        allowWithoutBalanceChangedAt: client.wallet?.allowWithoutBalanceChangedAt,
        allowWithoutBalanceChangedBy: client.wallet?.allowWithoutBalanceChangedBy || '',
        totalRecharged: Number((client.wallet?.totalRecharged || 0).toFixed(2)),
        totalSpent: Number((client.wallet?.totalSpent || 0).toFixed(2)),
        totalMessagesSent: client.wallet?.totalMessagesSent || 0,
        lowBalanceThreshold: client.wallet?.lowBalanceThreshold || 200,
        autoStopOnZero: client.wallet?.autoStopOnZero !== false,
        rateHistory: client.wallet?.rateHistory || []
      },
      client: {
        _id: client._id,
        name: client.name,
        customerCode: client.customerCode,
        softwareProduct: client.softwareProduct,
        contact: client.contact
      },
      transactions,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:clientId/recharge', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const {
      amount,
      ratePerMessage,
      paymentMode = 'UPI',
      referenceId = '',
      description = '',
      generateInvoice = false,
      gstInclusive = true,
      actor = {}
    } = req.body;

    const rechargeAmount = parseFloat(amount);
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid recharge amount is required' });
    }

    if (!client.wallet) {
      client.wallet = {
        balance: 0,
        messageRate: 0.90,
        currency: 'INR',
        allowWithoutBalance: false,
        totalRecharged: 0,
        totalSpent: 0,
        totalMessagesSent: 0,
        lowBalanceThreshold: 200,
        autoStopOnZero: true,
        rateHistory: []
      };
    }

    const currentRate = parseFloat(ratePerMessage) > 0
      ? parseFloat(ratePerMessage)
      : (parseFloat(client.wallet.messageRate) || 0.90);

    const balanceBefore = Number(client.wallet.balance || 0);
    const messagesBefore = currentRate > 0 ? Math.floor(balanceBefore / currentRate) : 0;

    const balanceAfter = Number((balanceBefore + rechargeAmount).toFixed(2));
    const messagesAdded = Math.floor(rechargeAmount / currentRate);
    const messagesAfter = Math.floor(balanceAfter / currentRate);

    client.wallet.balance = balanceAfter;
    client.wallet.messageRate = currentRate;
    client.wallet.totalRecharged = Number(((client.wallet.totalRecharged || 0) + rechargeAmount).toFixed(2));

    let taxInvoiceId = null;
    let taxInvoiceNumber = '';
    if (generateInvoice) {
      try {
        const gstRate = 0.18;
        let taxableValue = rechargeAmount;
        let taxAmount = 0;
        let totalBillAmount = rechargeAmount;

        if (gstInclusive) {
          taxableValue = Number((rechargeAmount / (1 + gstRate)).toFixed(2));
          taxAmount = Number((rechargeAmount - taxableValue).toFixed(2));
          totalBillAmount = rechargeAmount;
        } else {
          taxableValue = rechargeAmount;
          taxAmount = Number((rechargeAmount * gstRate).toFixed(2));
          totalBillAmount = Number((rechargeAmount + taxAmount).toFixed(2));
        }

        const invNum = `INV-WLT-${Date.now().toString().slice(-6)}`;

        const bill = new Bill({
          clientId: client._id,
          clientName: client.name,
          invoiceNumber: invNum,
          billType: 'GST',
          status: 'paid',
          currency: 'INR',
          items: [{
            description: `WhatsApp Message Wallet Top-up (${messagesAdded} messages @ Rs ${currentRate}/msg)`,
            hsnSac: '998413',
            quantity: messagesAdded,
            rate: currentRate,
            amount: taxableValue
          }],
          subTotal: taxableValue,
          taxRate: 18,
          taxAmount: taxAmount,
          cgst: Number((taxAmount / 2).toFixed(2)),
          sgst: Number((taxAmount / 2).toFixed(2)),
          igst: 0,
          totalAmount: totalBillAmount,
          paymentMode: paymentMode,
          paymentReference: referenceId,
          notes: description || `Wallet recharge by ${actor.name || 'Admin'}`
        });
        await bill.save();
        taxInvoiceId = bill._id;
        taxInvoiceNumber = invNum;
      } catch (invErr) {
        console.warn('[Wallet Recharge] Could not auto-generate invoice:', invErr.message);
      }
    }

    await client.save();

    const formattedTimestamp = formatIstTimestamp();
    const transaction = new WalletTransaction({
      clientId: client._id,
      customerCode: client.customerCode || client.subdomain || '',
      transactionType: 'RECHARGE',
      amount: rechargeAmount,
      ratePerMessage: currentRate,
      messagesCount: messagesAdded,
      balanceBefore,
      balanceAfter,
      messagesBefore,
      messagesAfter,
      paymentMode,
      referenceId: referenceId || `WLT-REC-${Date.now()}`,
      taxInvoiceId,
      taxInvoiceNumber,
      description: description || `Wallet recharge: Rs ${rechargeAmount} added (${messagesAdded} messages @ Rs ${currentRate}/msg)`,
      performedBy: {
        userId: actor.userId || req.user?._id || 'SUPER_ADMIN',
        name: actor.name || req.user?.name || 'Super Admin',
        mobile: actor.mobile || req.user?.mobile || '9345578103',
        role: actor.role || req.user?.role || 'SUPER_ADMIN'
      },
      formattedTimestamp
    });

    await transaction.save();
    await syncToTenant(client);

    res.status(201).json({
      success: true,
      message: `Successfully added Rs ${rechargeAmount} to ${client.name}'s wallet (${messagesAdded} messages credited).`,
      wallet: {
        balance: balanceAfter,
        messageRate: currentRate,
        availableCredits: messagesAfter,
        totalRecharged: client.wallet.totalRecharged
      },
      transaction
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:clientId/rate', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const { rate, actor = {} } = req.body;
    const newRate = parseFloat(rate);
    if (isNaN(newRate) || newRate <= 0) {
      return res.status(400).json({ success: false, message: 'Valid message rate is required (e.g. 0.90)' });
    }

    if (!client.wallet) {
      client.wallet = { balance: 0, messageRate: 0.90, currency: 'INR', rateHistory: [] };
    }

    const oldRate = client.wallet.messageRate || 0.90;
    client.wallet.messageRate = newRate;
    if (!client.wallet.rateHistory) client.wallet.rateHistory = [];
    client.wallet.rateHistory.push({
      rate: newRate,
      changedAt: new Date(),
      changedBy: actor.name ? `${actor.name} (${actor.mobile || actor.role || ''})` : 'Super Admin'
    });

    await client.save();
    await syncToTenant(client);

    const balance = Number(client.wallet.balance || 0);
    const newCredits = Math.floor(balance / newRate);

    res.json({
      success: true,
      message: `Message rate updated from Rs ${oldRate} to Rs ${newRate}/msg. Client now has ${newCredits} messages available.`,
      wallet: {
        balance,
        messageRate: newRate,
        availableCredits: newCredits
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:clientId/bypass-toggle', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const { allowWithoutBalance, actor = {} } = req.body;
    const requester = req.user || actor;
    if (!isSuperAdminUser(requester)) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Only Super Admin (9345578103) is authorized to configure the "Send Without Money" option.'
      });
    }

    if (!client.wallet) {
      client.wallet = { balance: 0, messageRate: 0.90, currency: 'INR' };
    }

    const newState = !!allowWithoutBalance;
    client.wallet.allowWithoutBalance = newState;
    client.wallet.allowWithoutBalanceChangedAt = new Date();
    client.wallet.allowWithoutBalanceChangedBy = `${requester.name || 'Super Admin'} (${requester.mobile || '9345578103'})`;

    await client.save();

    const formattedTimestamp = formatIstTimestamp();
    const auditRecord = new WalletTransaction({
      clientId: client._id,
      customerCode: client.customerCode || client.subdomain || '',
      transactionType: 'ADJUSTMENT_CREDIT',
      amount: 0,
      ratePerMessage: client.wallet.messageRate || 0.90,
      messagesCount: 0,
      balanceBefore: client.wallet.balance || 0,
      balanceAfter: client.wallet.balance || 0,
      messagesBefore: Math.floor((client.wallet.balance || 0) / (client.wallet.messageRate || 0.90)),
      messagesAfter: Math.floor((client.wallet.balance || 0) / (client.wallet.messageRate || 0.90)),
      paymentMode: 'SYSTEM_ADJUSTMENT',
      referenceId: `BYPASS-${newState ? 'ENABLED' : 'DISABLED'}-${Date.now()}`,
      description: `Super Admin ${newState ? 'ENABLED' : 'DISABLED'} 'Allow Sending Without Money / Bypass Wallet Gate' option.`,
      performedBy: {
        userId: requester._id || requester.userId || 'SUPER_ADMIN',
        name: requester.name || 'Super Admin',
        mobile: requester.mobile || '9345578103',
        role: 'SUPER_ADMIN'
      },
      formattedTimestamp
    });
    await auditRecord.save();

    await syncToTenant(client);

    res.json({
      success: true,
      message: `Super Admin configured 'Send Without Money': ${newState ? 'ENABLED (Client can send messages with Rs 0 balance)' : 'DISABLED (Standard prepaid balance required)'}.`,
      allowWithoutBalance: newState,
      client: {
        _id: client._id,
        name: client.name,
        wallet: client.wallet
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:clientId/consume', async (req, res) => {
  try {
    const { clientId } = req.params;
    let client;
    if (clientId.match(/^[0-9a-fA-F]{24}$/)) {
      client = await Client.findById(clientId);
    } else {
      client = await Client.findOne({
        $or: [
          { customerCode: clientId.toLowerCase() },
          { subdomain: clientId.toLowerCase() },
          { shopSlug: clientId.toLowerCase() }
        ]
      });
    }

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const {
      messagesCount = 1,
      campaignId = '',
      campaignName = '',
      referenceId = '',
      description = '',
      user = {}
    } = req.body;

    const count = parseInt(messagesCount) || 1;
    const rate = Number(client.wallet?.messageRate || 0.90);
    const cost = Number((count * rate).toFixed(2));

    const balanceBefore = Number(client.wallet?.balance || 0);
    const messagesBefore = rate > 0 ? Math.floor(balanceBefore / rate) : 0;
    const isBypassActive = !!client.wallet?.allowWithoutBalance;

    if (!isBypassActive && balanceBefore < cost && messagesBefore < count) {
      return res.status(402).json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        message: `Insufficient message credits. Need ${count} messages (Rs ${cost}), but only have ${messagesBefore} messages left (Balance: Rs ${balanceBefore}).`,
        balance: balanceBefore,
        availableCredits: messagesBefore,
        rate
      });
    }

    let balanceAfter = balanceBefore;
    let transactionType = 'USAGE_DEDUCTION';

    if (!isBypassActive) {
      balanceAfter = Number(Math.max(0, balanceBefore - cost).toFixed(2));
      client.wallet.balance = balanceAfter;
      client.wallet.totalSpent = Number(((client.wallet.totalSpent || 0) + cost).toFixed(2));
    } else {
      if (balanceBefore >= cost) {
        balanceAfter = Number((balanceBefore - cost).toFixed(2));
        client.wallet.balance = balanceAfter;
        client.wallet.totalSpent = Number(((client.wallet.totalSpent || 0) + cost).toFixed(2));
      } else {
        transactionType = 'POSTPAID_DISPATCH';
      }
    }

    client.wallet.totalMessagesSent = (client.wallet.totalMessagesSent || 0) + count;
    await client.save();

    const messagesAfter = rate > 0 ? Math.floor(balanceAfter / rate) : 0;
    const formattedTimestamp = formatIstTimestamp();

    const transaction = new WalletTransaction({
      clientId: client._id,
      customerCode: client.customerCode || client.subdomain || '',
      transactionType,
      amount: -cost,
      ratePerMessage: rate,
      messagesCount: -count,
      balanceBefore,
      balanceAfter,
      messagesBefore,
      messagesAfter,
      paymentMode: isBypassActive && transactionType === 'POSTPAID_DISPATCH' ? 'POSTPAID_BYPASS' : 'SYSTEM_ADJUSTMENT',
      referenceId: referenceId || campaignId || `DISPATCH-${Date.now()}`,
      description: description || `Dispatched ${count} WhatsApp message(s)${campaignName ? ' for ' + campaignName : ''}${isBypassActive ? ' [Bypass Mode]' : ''}`,
      performedBy: {
        userId: user.userId || user._id || 'CLIENT_USER',
        name: user.name || 'WhatsApp Client App',
        mobile: user.mobile || client.contact || '',
        role: user.role || 'client'
      },
      formattedTimestamp
    });

    await transaction.save();
    await syncToTenant(client);

    res.json({
      success: true,
      deducted: cost,
      messagesCount: count,
      balanceAfter,
      messagesAfter,
      transaction
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:clientId/refund', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const {
      failedCount = 1,
      reason = 'Delivery failed / Invalid phone number',
      referenceId = ''
    } = req.body;

    const count = parseInt(failedCount) || 1;
    const rate = Number(client.wallet?.messageRate || 0.90);
    const refundAmount = Number((count * rate).toFixed(2));

    const balanceBefore = Number(client.wallet?.balance || 0);
    const balanceAfter = Number((balanceBefore + refundAmount).toFixed(2));

    client.wallet.balance = balanceAfter;
    if (client.wallet.totalSpent >= refundAmount) {
      client.wallet.totalSpent = Number((client.wallet.totalSpent - refundAmount).toFixed(2));
    }
    await client.save();

    const messagesBefore = rate > 0 ? Math.floor(balanceBefore / rate) : 0;
    const messagesAfter = rate > 0 ? Math.floor(balanceAfter / rate) : 0;
    const formattedTimestamp = formatIstTimestamp();

    const transaction = new WalletTransaction({
      clientId: client._id,
      customerCode: client.customerCode || client.subdomain || '',
      transactionType: 'REFUND_DISPATCH_FAILURE',
      amount: refundAmount,
      ratePerMessage: rate,
      messagesCount: count,
      balanceBefore,
      balanceAfter,
      messagesBefore,
      messagesAfter,
      paymentMode: 'SYSTEM_ADJUSTMENT',
      referenceId: referenceId || `REFUND-${Date.now()}`,
      description: `Auto-refund for ${count} failed WhatsApp message(s): ${reason}`,
      performedBy: {
        userId: 'SYSTEM',
        name: 'Auto-Refund Engine',
        mobile: '',
        role: 'SYSTEM'
      },
      formattedTimestamp
    });

    await transaction.save();
    await syncToTenant(client);

    res.json({
      success: true,
      refunded: refundAmount,
      balanceAfter,
      messagesAfter
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
