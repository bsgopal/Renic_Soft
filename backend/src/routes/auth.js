import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const signToken = (user) => jwt.sign(
  { id: user._id },
  process.env.JWT_SECRET || 'supersecretrenicsoftkey12345',
  { expiresIn: '30d' }
);

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const identifier = (req.body.mobile || req.body.email || req.body.phone || req.body.username || req.body.login || req.body.identifier || '').trim();
  const { password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Please provide mobile number or email and password' });
  }
  try {
    let user = await dbHelper.findOne('User', {
      $or: [
        { mobile: identifier },
        { email: identifier.toLowerCase() }
      ]
    });

    // If user not in User collection, check Client collection for matching owner credentials
    if (!user) {
      const client = await dbHelper.findOne('Client', {
        $or: [
          { pendingOwnerMobile: identifier },
          { pendingOwnerEmail: identifier.toLowerCase() },
          { customerCode: identifier.toUpperCase() },
          { contact: identifier }
        ]
      });

      if (client && client.pendingOwnerPassword) {
        const isMatch = await bcrypt.compare(password, client.pendingOwnerPassword);
        if (isMatch) {
          // Auto-seed into master users collection
          user = await dbHelper.create('User', {
            name: client.pendingOwnerName || client.name,
            email: (client.pendingOwnerEmail || `${client.customerCode.toLowerCase()}@client.com`).toLowerCase(),
            mobile: client.pendingOwnerMobile || client.contact || identifier,
            password: client.pendingOwnerPassword,
            role: 'client_admin',
            clientId: client._id,
            isActive: true
          });
        }
      }
    }

    if (!user) return res.status(401).json({ message: 'Invalid mobile number, email, or password' });
    if (!user.isActive) return res.status(401).json({ message: 'This user account is deactivated' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid mobile number, email, or password' });

    // License expiry / status validation for non-platform users
    if (user.role !== 'platform_owner' && user.clientId) {
      const client = await dbHelper.findById('Client', user.clientId);
      if (client) {
        if (client.licenseEnd && new Date() > new Date(client.licenseEnd)) {
          return res.status(403).json({ message: 'Your store license has expired. Please contact the platform owner to update your license.' });
        }
        if (client.licenseStatus === 'locked' || client.licenseStatus === 'cancelled') {
          return res.status(403).json({ message: 'Your store license is locked or cancelled. New logins are blocked.' });
        }
      }
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        permissions: user.permissions,
        clientId: user.clientId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  const user = await dbHelper.findById('User', req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  let client = null;
  if (user.clientId) client = await dbHelper.findById('Client', user.clientId);
  res.json({ user, client });
});

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await dbHelper.findById('User', req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await dbHelper.findByIdAndUpdate('User', user._id, { password: hashedPassword });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// @desc    Forgot Password - Request reset link
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const identifier = (req.body.email || req.body.phone || req.body.mobile || req.body.username || req.body.identifier || req.body.login || '').trim();
    const clientId = (req.body.clientId || req.body.customerCode || req.body.tenantId || '').trim();

    if (!identifier && !clientId) {
      return res.status(400).json({ message: 'Please provide your registered email, mobile, phone number, or client ID' });
    }

    let user = null;
    if (identifier) {
      user = await dbHelper.findOne('User', {
        $or: [
          { email: identifier.toLowerCase() },
          { mobile: identifier },
          { phone: identifier }
        ]
      });
    }

    // Lookup in Client collection
    let client = null;
    if (!user) {
      const clientQueries = [];
      if (identifier) {
        clientQueries.push(
          { pendingOwnerEmail: identifier.toLowerCase() },
          { pendingOwnerMobile: identifier },
          { contact: identifier },
          { customerCode: identifier.toUpperCase() },
          { email: identifier.toLowerCase() },
          { clientId: identifier }
        );
      }
      if (clientId) {
        clientQueries.push(
          { customerCode: clientId.toUpperCase() },
          { clientId: clientId },
          { id: clientId }
        );
      }

      client = await dbHelper.findOne('Client', { $or: clientQueries });
      if (client) {
        user = await dbHelper.findOne('User', {
          $or: [
            { email: (client.pendingOwnerEmail || client.email || '').toLowerCase() },
            { mobile: client.pendingOwnerMobile || client.contact || identifier }
          ]
        });

        if (!user) {
          user = await dbHelper.create('User', {
            name: client.pendingOwnerName || client.name,
            email: (client.pendingOwnerEmail || client.email || `${client.customerCode.toLowerCase()}@client.com`).toLowerCase(),
            mobile: client.pendingOwnerMobile || client.contact || identifier,
            password: client.pendingOwnerPassword || '$2a$10$abcdefghijklmnopqrstuu',
            role: 'client_admin',
            clientId: client._id,
            isActive: true
          });
        }
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User with this email, mobile number, or client ID does not exist' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expireTime = new Date(Date.now() + 3600000); // 1 hour

    await dbHelper.findByIdAndUpdate('User', user._id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: expireTime
    });

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    console.log(`[Renic Soft FORGOT PASSWORD] Generated reset token for ${user.email || user.mobile} | Link: ${resetUrl}`);

    res.json({
      success: true,
      message: 'Password reset link generated successfully!',
      resetLink: resetUrl
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Forgot password operation failed' });
  }
});

// @desc    Reset Password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password, retypePassword } = req.body;
    const { token } = req.params;

    if (!password || !retypePassword) {
      return res.status(400).json({ message: 'Please fill in all password fields' });
    }

    if (password !== retypePassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await dbHelper.findOne('User', {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset token or token has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(password, salt);

    await dbHelper.findByIdAndUpdate('User', user._id, {
      password: newHash,
      resetPasswordToken: null,
      resetPasswordExpire: null
    });

    // Cross-sync to tenant DBs and Client pendingOwnerPassword
    try {
      if (mongoose.connection && mongoose.connection.db) {
        const adminDb = mongoose.connection.db.admin();
        const dbs = await adminDb.listDatabases();
        const tenantDbNames = dbs.databases
          .map(d => d.name)
          .filter(name => name.startsWith('renic_tenant_') || name.startsWith('renic_trial_'));

        for (const dbName of tenantDbNames) {
          const tDb = mongoose.connection.useDb(dbName, { useCache: true });
          await tDb.collection('users').updateMany(
            {
              $or: [
                { email: user.email },
                { phone: user.mobile },
                { mobile: user.mobile }
              ]
            },
            { $set: { password: newHash, updatedAt: new Date() } }
          );
        }

        const masterDb = mongoose.connection.useDb('renic_soft', { useCache: true });
        await masterDb.collection('clients').updateMany(
          {
            $or: [
              { pendingOwnerEmail: user.email },
              { pendingOwnerMobile: user.mobile }
            ]
          },
          { $set: { pendingOwnerPassword: newHash, updatedAt: new Date() } }
        );
      }
    } catch (syncErr) {
      console.warn('[Renic Soft Reset Sync Note]:', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Password reset successful! You can now log in.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Reset password operation failed' });
  }
});

export default router;