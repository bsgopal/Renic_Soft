import express from 'express';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const computeTotals = (items) => {
  let subTotal = 0, discountTotal = 0, taxTotal = 0;
  items.forEach((it) => {
    const gross = it.qty * it.rate;
    const disc = (gross * (it.discountPercent || 0)) / 100;
    const beforeTax = gross - disc;
    const tax = (beforeTax * (it.gstPercent || 0)) / 100;
    subTotal += gross;
    discountTotal += disc;
    taxTotal += tax;
    it.amount = beforeTax + tax;
  });
  const grandTotal = subTotal - discountTotal + taxTotal;
  return { subTotal, discountTotal, taxTotal, grandTotal };
};

const nextNumber = async (prefix) => {
  const all = await dbHelper.find('Quotation', {});
  const max = all.reduce((m, q) => {
    const num = parseInt((q.quoteNumber || '').replace(prefix, ''), 10);
    return isNaN(num) ? m : Math.max(m, num);
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
};

// @desc    Get quotations (platform owner: all; store admin: own store)
// @route   GET /api/quotes
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'platform_owner' ? {} : { clientId: req.user.clientId };
    let quotes = await dbHelper.find('Quotation', filter);
    quotes = quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving quotations' });
  }
});

// @desc    Get single quotation
// @route   GET /api/quotes/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const quote = await dbHelper.findById('Quotation', req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quotation not found' });
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving quotation' });
  }
});

// @desc    Create new quotation
// @route   POST /api/quotes
// @access  Private
router.post('/', protect, async (req, res) => {
  const { customerName, customerPhone, customerEmail, customerAddress, customerGSTIN, validUntil, items, notes, terms, status, advanceDeposit } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ message: 'At least one quotation item is required' });
  }
  try {
    const quoteNumber = await nextNumber('RN-QT-');
    const totals = computeTotals(items);
    // Store is optional: quotations can be created for new / walk-in customers too
    let clientId = req.user.role === 'platform_owner' ? (req.body.clientId || null) : (req.user.clientId || null);
    if (!clientId || clientId === '') clientId = null;

    const quoteData = {
      quoteNumber,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      customerAddress: customerAddress || '',
      customerGSTIN: customerGSTIN || '',
      quoteDate: new Date().toISOString(),
      validUntil: validUntil || new Date(Date.now() + 30 * 24 * 3600 * 1000),
      items,
      ...totals,
      notes: notes || '',
      terms: terms || '',
      advanceDeposit: Number(advanceDeposit) || 0,
      status: status || 'draft'
    };
    if (clientId) quoteData.clientId = clientId;

    const quote = await dbHelper.create('Quotation', quoteData);
    res.status(201).json({ success: true, message: 'Quotation created successfully', quotation: quote });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({ message: 'Error creating quotation' });
  }
});

// @desc    Update a quotation
// @route   PUT /api/quotes/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await dbHelper.findById('Quotation', req.params.id);
    if (!existing) return res.status(404).json({ message: 'Quotation not found' });

    const updates = { ...req.body };
    if (req.body.items && req.body.items.length) {
      const totals = computeTotals(req.body.items);
      Object.assign(updates, totals);
    }
    delete updates.clientId;
    const updated = await dbHelper.findByIdAndUpdate('Quotation', req.params.id, updates);
    res.json({ success: true, message: 'Quotation updated successfully', quotation: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating quotation' });
  }
});

// @desc    Delete a quotation
// @route   DELETE /api/quotes/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    await dbHelper.deleteById('Quotation', req.params.id);
    res.json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting quotation' });
  }
});

export default router;