import express from 'express';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../models/dbHelper.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendLicenseEmail, sendActivationOtpEmail } from '../utils/mailer.js';
import { encryptLicense, decryptLicense } from '../utils/licenseCrypto.js';

const router = express.Router();

// @desc    Extract and decrypt license details from a pasted key
// @route   POST /api/clients/activate/extract
// @access  Public
router.post('/activate/extract', async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ message: 'License key is required' });
  }
  try {
    const decoded = decryptLicense(licenseKey.trim());
    const details = {
      name: decoded.name,
      gstNumber: decoded.gstNumber || '',
      address: decoded.address || '',
      contact: decoded.contact || '',
      planTier: decoded.planTier || 'basic',
      licenseStart: decoded.licenseStart,
      licenseEnd: decoded.licenseEnd,
      pendingOwnerName: decoded.pendingOwnerName,
      pendingOwnerEmail: decoded.pendingOwnerEmail,
      pendingOwnerMobile: decoded.pendingOwnerMobile,
      pendingOwnerRole: decoded.pendingOwnerRole || 'admin'
    };
    res.json({ success: true, details });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or corrupted license key' });
  }
});

// @desc    Verify License Key and send OTP
// @route   POST /api/licenses/activate/verify-key
// @access  Public
router.post('/activate/verify-key', async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ message: 'License key is required' });
  }
  try {
    let decoded;
    try {
      decoded = decryptLicense(licenseKey.trim());
    } catch (err) {
      return res.status(400).json({ message: 'Invalid License Key or signature verification failed.' });
    }

    const {
      name, gstNumber, address, contact, planTier, licenseStart, licenseEnd,
      pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword, pendingOwnerRole
    } = decoded;

    let localClient = await dbHelper.findOne('Client', { licenseKey: licenseKey.trim() });

    let maxFloors = 1, maxUsers = 3, maxProducts = 2000;
    if (planTier === 'pro') { maxFloors = 3; maxUsers = 10; maxProducts = 10000; }
    else if (planTier === 'enterprise') { maxFloors = 99; maxUsers = 999; maxProducts = 999999; }

    if (!localClient) {
      localClient = await dbHelper.create('Client', {
        name,
        gstNumber: gstNumber || '',
        address: address || '',
        contact: contact || '',
        licenseKey: licenseKey.trim(),
        licenseStatus: 'pending_activation',
        licenseStart: licenseStart || new Date().toISOString(),
        licenseEnd,
        planTier: planTier || 'basic',
        maxFloors, maxUsers, maxProducts,
        pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword,
        pendingOwnerRole: pendingOwnerRole || 'admin'
      });
    } else {
      if (localClient.licenseStatus === 'active') {
        return res.status(400).json({ message: 'License is already active' });
      }
      await dbHelper.findByIdAndUpdate('Client', localClient._id, {
        licenseStatus: 'pending_activation',
        pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword,
        pendingOwnerRole: pendingOwnerRole || 'admin'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 10);

    await dbHelper.findByIdAndUpdate('Client', localClient._id, {
      activationOtp: otp,
      activationOtpExpires: otpExpires
    });

    await sendActivationOtpEmail(pendingOwnerEmail, otp);

    res.json({
      success: true,
      email: pendingOwnerEmail,
      message: 'License verified. Activation code sent to your registered email.'
    });
  } catch (error) {
    console.error('License key verify error:', error);
    res.status(500).json({ message: 'Error verifying license key' });
  }
});

// @desc    Verify Activation OTP and register Admin user
// @route   POST /api/licenses/activate/verify-otp
// @access  Public
router.post('/activate/verify-otp', async (req, res) => {
  const { licenseKey, otp } = req.body;
  if (!licenseKey || !otp) {
    return res.status(400).json({ message: 'License key and OTP are required' });
  }
  try {
    const client = await dbHelper.findOne('Client', { licenseKey: licenseKey.trim() });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.activationOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }
    if (new Date() > new Date(client.activationOtpExpires)) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    await dbHelper.findByIdAndUpdate('Client', client._id, {
      licenseStatus: 'active',
      activationOtp: '',
      activationOtpExpires: null,
      defaultRolesSeeded: true
    });

    const existingUser = await dbHelper.findOne('User', { mobile: client.pendingOwnerMobile });
    if (!existingUser) {
      await dbHelper.create('User', {
        clientId: client._id,
        name: client.pendingOwnerName,
        mobile: client.pendingOwnerMobile,
        email: client.pendingOwnerEmail,
        password: client.pendingOwnerPassword,
        role: client.pendingOwnerRole || 'admin',
        permissions: { create_product: true, edit_prices: true, view_reports: true, approve_returns: true, access_suppliers: true },
        isActive: true
      });
    } else {
      await dbHelper.findByIdAndUpdate('User', existingUser._id, {
        role: client.pendingOwnerRole || 'admin',
        isActive: true
      });
    }

    res.json({ success: true, message: 'License activated and administrator profile registered successfully!' });
  } catch (error) {
    console.error('Activation OTP verify error:', error);
    res.status(500).json({ message: 'Error verifying activation OTP code' });
  }
});

// @desc    Get all shops / clients (licenses)
// @route   GET /api/licenses
// @access  Private (Platform Owner only)
router.get('/', protect, authorize('platform_owner'), async (req, res) => {
  try {
    const clients = await dbHelper.find('Client', {});
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving clients' });
  }
});

// @desc    Create new client shop license
// @route   POST /api/licenses
// @access  Private (Platform Owner only)
router.post('/', protect, authorize('platform_owner'), async (req, res) => {
  const {
    name, gstNumber, address, contact, planTier, licenseDurationDays,
    ownerEmail, ownerMobile, ownerPassword
  } = req.body;

  if (!name || !ownerEmail || !ownerMobile || !ownerPassword) {
    return res.status(400).json({ message: 'Shop name, owner email, mobile, and password are required' });
  }

  try {
    const licenseEnd = new Date();
    licenseEnd.setDate(licenseEnd.getDate() + parseInt(licenseDurationDays || 30));

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const licensePayload = {
      name,
      gstNumber: gstNumber || '',
      address: address || '',
      contact: contact || '',
      planTier: planTier || 'basic',
      licenseDurationDays: parseInt(licenseDurationDays || 30),
      licenseStart: new Date().toISOString(),
      licenseEnd: licenseEnd.toISOString(),
      pendingOwnerName: contact || `${name} Owner`,
      pendingOwnerEmail: ownerEmail,
      pendingOwnerMobile: ownerMobile,
      pendingOwnerPassword: hashedPassword,
      pendingOwnerRole: 'admin'
    };

    // Encrypt the license key with AES-256-CBC (SAP level security)
    const licenseKey = encryptLicense(licensePayload);

    let maxFloors = 1, maxUsers = 3, maxProducts = 2000;
    if (planTier === 'pro') { maxFloors = 3; maxUsers = 10; maxProducts = 10000; }
    else if (planTier === 'enterprise') { maxFloors = 99; maxUsers = 999; maxProducts = 999999; }

    const newClient = await dbHelper.create('Client', {
      name,
      gstNumber: gstNumber || '',
      address: address || '',
      contact: contact || '',
      licenseKey,
      licenseStatus: 'pending_activation',
      licenseStart: new Date().toISOString(),
      licenseEnd: licenseEnd.toISOString(),
      planTier: planTier || 'basic',
      maxFloors, maxUsers, maxProducts,
      pendingOwnerName: contact || `${name} Owner`,
      pendingOwnerEmail: ownerEmail,
      pendingOwnerMobile: ownerMobile,
      pendingOwnerPassword: hashedPassword,
      pendingOwnerRole: 'admin'
    });

    await sendLicenseEmail(req.user.email, {
      shopName: name,
      licenseKey,
      licenseEnd,
      ownerName: contact || `${name} Owner`,
      ownerMobile,
      ownerEmail
    });

    res.status(201).json({
      success: true,
      message: 'License generated in pending state. Details emailed to platform owner.',
      client: newClient
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Error creating client shop profile' });
  }
});

// @desc    Renew or edit client license
// @route   PUT /api/licenses/:id/renew
// @access  Private (Platform Owner only)
router.put('/:id/renew', protect, authorize('platform_owner'), async (req, res) => {
  const { id } = req.params;
  const { durationDays, planTier, licenseStatus, name, gstNumber, address, contact } = req.body;

  try {
    const client = await dbHelper.findById('Client', id);
    if (!client) return res.status(404).json({ message: 'Client shop not found' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (gstNumber !== undefined) updates.gstNumber = gstNumber;
    if (address !== undefined) updates.address = address;
    if (contact !== undefined) updates.contact = contact;

    let updatedEnd = new Date(client.licenseEnd);
    if (durationDays) {
      const baseDate = new Date(client.licenseEnd) > new Date() ? new Date(client.licenseEnd) : new Date();
      baseDate.setDate(baseDate.getDate() + parseInt(durationDays));
      updatedEnd = baseDate;
    }
    updates.licenseEnd = updatedEnd.toISOString();
    if (licenseStatus) updates.licenseStatus = licenseStatus;
    if (planTier) {
      updates.planTier = planTier;
      if (planTier === 'basic') updates.maxFloors = 1, updates.maxUsers = 3, updates.maxProducts = 2000;
      else if (planTier === 'pro') updates.maxFloors = 3, updates.maxUsers = 10, updates.maxProducts = 10000;
      else if (planTier === 'enterprise') updates.maxFloors = 99, updates.maxUsers = 999, updates.maxProducts = 999999;
    }

    const updatedClient = await dbHelper.findByIdAndUpdate('Client', id, updates);
    res.json(updatedClient);
  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json({ message: 'Error updating client profile' });
  }
});

// @desc    Delete a client license
// @route   DELETE /api/licenses/:id
// @access  Private (Platform Owner only)
router.delete('/:id', protect, authorize('platform_owner'), async (req, res) => {
  try {
    await dbHelper.deleteById('Client', req.params.id);
    res.json({ success: true, message: 'License deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting license' });
  }
});

export default router;