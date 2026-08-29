import express from 'express';
import { getCompany, saveCompany } from '../utils/company.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get configured company profile
// @route   GET /api/settings/company
// @access  Private (all authenticated users)
router.get('/company', protect, async (req, res) => {
  try {
    res.json(await getCompany());
  } catch (err) {
    console.error('Get company settings error:', err);
    res.status(500).json({ message: 'Failed to load company settings' });
  }
});

// @desc    Update company profile (used on quotation / invoice PDFs)
// @route   PUT /api/settings/company
// @access  Private (platform owner only)
router.put('/company', protect, async (req, res) => {
  try {
    if (req.user.role !== 'platform_owner') {
      return res.status(403).json({ message: 'Only the platform owner can update company settings' });
    }
    const value = await saveCompany(req.body);
    res.json({ message: 'Company settings saved', company: value });
  } catch (err) {
    console.error('Save company settings error:', err);
    res.status(500).json({ message: 'Failed to save company settings' });
  }
});

export default router;