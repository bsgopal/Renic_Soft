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

const nextInvoiceNumber = async () => {
  const all = await dbHelper.find('Bill', {});
  const max = all.reduce((m, b) => {
    const num = parseInt((b.invoiceNumber || '').replace('REN-INV-', ''), 10);
    return isNaN(num) ? m : Math.max(m, num);
  }, 0);
  return `REN-INV-${String(max + 1).padStart(5, '0')}`;
};

// @desc    Get all bills (platform owner: all; client: own store)
// @route   GET /api/bills
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'platform_owner' ? {} : { clientId: req.user.clientId };
    let bills = await dbHelper.find('Bill', filter);
    bills = bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving bills' });
  }
});

// @desc    Get single invoice
// @route   GET /api/bills/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bill = await dbHelper.findById('Bill', req.params.id);
    if (!bill) return res.status(404).json({ message: 'Invoice not found' });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving invoice' });
  }
});

// @desc    Create a new invoice (billing)
// @route   POST /api/bills
// @access  Private
router.post('/', protect, async (req, res) => {
  const {
    customerName, customerPhone, customerEmail, customerAddress, customerGSTIN,
    invoiceDate, dueDate, items, paymentMethod, amountPaid, notes, quoteId, status
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ message: 'At least one invoice item is required' });
  }

  try {
    const invoiceNumber = await nextInvoiceNumber();
    const totals = computeTotals(items);
    // Store is optional: invoices can be created for new / walk-in customers too
    const clientId = req.user.role === 'platform_owner' ? (req.body.clientId || null) : req.user.clientId;

    const paid = amountPaid || 0;
    let billStatus = status || (paid >= totals.grandTotal ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid');

    const bill = await dbHelper.create('Bill', {
      clientId,
      invoiceNumber,
      quoteId: quoteId || null,
      cashierId: req.user._id,
      cashierName: req.user.name,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      customerAddress: customerAddress || '',
      customerGSTIN: customerGSTIN || '',
      invoiceDate: invoiceDate || new Date().toISOString(),
      dueDate: dueDate || null,
      items,
      ...totals,
      amountPaid: paid,
      balanceDue: Math.max(totals.grandTotal - paid, 0),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      status: billStatus
    });

    if (quoteId) {
      await dbHelper.findByIdAndUpdate('Quotation', quoteId, {
        status: 'converted',
        convertedToBill: true,
        billId: bill._id
      });
    }

    res.status(201).json({ success: true, message: 'Invoice created successfully', bill });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Error creating invoice' });
  }
});

// @desc    Update invoice (payments / status / details)
// @route   PUT /api/bills/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await dbHelper.findById('Bill', req.params.id);
    if (!existing) return res.status(404).json({ message: 'Invoice not found' });

    const updates = { ...req.body };
    delete updates._id;

    if (req.body.amountPaid !== undefined) {
      const paid = req.body.amountPaid || 0;
      const grandTotal = existing.grandTotal;
      updates.amountPaid = paid;
      updates.balanceDue = Math.max(grandTotal - paid, 0);
      updates.status = req.body.status || (paid >= grandTotal ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid');
    }

    const updated = await dbHelper.findByIdAndUpdate('Bill', req.params.id, updates);
    res.json({ success: true, message: 'Invoice updated successfully', bill: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating invoice' });
  }
});

// @desc    Delete an invoice
// @route   DELETE /api/bills/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    await dbHelper.deleteById('Bill', req.params.id);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice' });
  }
});

export default router;