import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  const { mobile, password } = req.body;
  if (!mobile || !password) {
    return res.status(400).json({ message: 'Please provide mobile number and password' });
  }
  try {
    const user = await dbHelper.findOne('User', { mobile: mobile.trim() });
    if (!user) return res.status(401).json({ message: 'Invalid mobile number or password' });
    if (!user.isActive) return res.status(401).json({ message: 'This user account is deactivated' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid mobile number or password' });

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
    res.status(500).json({ message: 'Error during login' });
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

export default router;