import express from 'express';
import XLSX from 'xlsx';
import { dbHelper } from '../models/dbHelper.js';
import { protect } from '../middleware/auth.js';
import { buildReportBuffer, buildQuotationBuffer } from '../utils/pdfExport.js';
import { resolveDocCompany, getCompany } from '../utils/company.js';

const router = express.Router();

const money = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const setDownload = (res, filename, contentType) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};

const sendXlsx = (res, filename, rows, headers, sheet = 'Report') => {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  setDownload(res, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

const handleReport = async (req, res, { filename, title, headers, rightAligned, rows, summary }) => {
  const format = req.query.format || 'pdf';
  if (format === 'xlsx') {
    return sendXlsx(res, filename.replace('.pdf', '.xlsx'), rows, headers, title);
  }
  const buffer = await buildReportBuffer({ companyName: 'Renic Soft', title, subtitle: req.user.name, headers, rows, rightAligned, summary });
  setDownload(res, filename, 'application/pdf');
  res.send(buffer);
};

// @desc    Export licenses list (PDF / Excel)
// @route   GET /api/export/licenses
// @access  Private
router.get('/licenses', protect, async (req, res) => {
  try {
    const clients = await dbHelper.find('Client', {});
    const now = new Date();
    const filter = req.query.filter || 'all';

    const filtered = clients.filter((c) => {
      const end = new Date(c.licenseEnd);
      const daysLeft = Math.ceil((end - now) / (24 * 3600 * 1000));
      switch (filter) {
        case 'active': return c.licenseStatus === 'active' && daysLeft >= 0;
        case 'expiring': return c.licenseStatus === 'active' && daysLeft >= 0 && daysLeft <= 30;
        case 'expired': return daysLeft < 0;
        case 'locked': return c.licenseStatus === 'locked' || c.licenseStatus === 'cancelled';
        default: return true;
      }
    });

    const rows = filtered.map((c) => {
      const end = new Date(c.licenseEnd);
      const daysLeft = Math.ceil((end - now) / (24 * 3600 * 1000));
      return [
        c.name, c.gstNumber || '', c.planTier, fmt(c.licenseStart), fmt(c.licenseEnd),
        daysLeft < 0 ? 'Expired' : `${daysLeft} days`, c.licenseStatus
      ];
    });

    const summary = [
      { label: 'Total Licenses', value: String(clients.length) },
      { label: 'In Filter', value: String(filtered.length) },
      { label: 'Active', value: String(clients.filter((c) => c.licenseStatus === 'active').length) }
    ];

    await handleReport(req, res, {
      filename: `licenses-${filter}.pdf`,
      headers: ['Business Name', 'GSTIN', 'Plan', 'Start Date', 'Expiry Date', 'Days Left', 'Status'],
      rightAligned: [],
      rows,
      summary
    });
  } catch (err) {
    console.error('Export licenses error:', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

// @desc    GET quotations list (PDF / Excel)
// @route   GET /api/export/quotes
// @access  Private
router.get('/quotes', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'platform_owner' ? {} : { clientId: req.user.clientId };
    let quotes = await dbHelper.find('Quotation', filter);
    quotes = quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const rows = quotes.map((q) => [
      q.quoteNumber, q.customerName || '', q.items?.length || 0,
      money(q.subTotal), money(q.discountTotal), money(q.taxTotal), money(q.grandTotal),
      fmt(q.quoteDate), q.validUntil ? fmt(q.validUntil) : '', q.status
    ]);

    const total = quotes.reduce((s, q) => s + (q.grandTotal || 0), 0);
    const summary = [
      { label: 'Total Quotations', value: String(quotes.length) },
      { label: 'Accepted / Converted', value: String(quotes.filter((q) => q.status === 'accepted' || q.status === 'converted').length) },
      { label: 'Total Value', value: money(total) }
    ];

    await handleReport(req, res, {
      filename: `quotations-${Date.now()}.pdf`,
      title: 'Quotations Report',
      headers: ['Quote No', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Grand Total', 'Date', 'Valid Until', 'Status'],
      rightAligned: ['Subtotal', 'Discount', 'Tax', 'Grand Total'],
      rows,
      summary
    });
  } catch (err) {
    console.error('Export quotes error:', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

// ---------- Export billing / payment lists ----------
// @desc    GET /api/export/bills?filter=all|pending|paid|unpaid
router.get('/bills', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'platform_owner' ? {} : { clientId: req.user.clientId };
    let bills = await dbHelper.find('Bill', filter);
    bills = bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const f = req.query.filter || 'all';
    const filtered = bills.filter((b) => {
      const due = b.balanceDue || 0;
      if (f === 'pending') return due > 0;
      if (f === 'paid') return b.status === 'Paid';
      if (f === 'unpaid') return b.amountPaid === 0 && b.status !== 'Paid';
      return true;
    });

    const rows = filtered.map((b) => [
      b.invoiceNumber, b.customerName || '', fmt(b.invoiceDate),
      money(b.grandTotal), money(b.discountTotal), money(b.taxTotal),
      money(b.amountPaid), money(b.balanceDue), b.paymentMethod, b.status
    ]);

    const revenue = bills.filter((b) => b.status === 'Paid').reduce((s, b) => s + (b.grandTotal || 0), 0);
    const outstanding = bills.reduce((s, b) => s + (b.balanceDue || 0), 0);

    const summary = [
      { label: 'Total Invoices', value: String(filtered.length) },
      { label: 'Collected Revenue', value: money(revenue) },
      { label: 'Outstanding', value: money(outstanding) }
    ];

    await handleReport(req, res, {
      filename: `bills-${f}-${Date.now()}.pdf`,
      title: `Billing Report — ${f.toUpperCase()}`,
      headers: ['Invoice No', 'Customer', 'Date', 'Total', 'Discount', 'Tax', 'Paid', 'Balance', 'Method', 'Status'],
      rightAligned: ['Total', 'Discount', 'Tax', 'Paid', 'Balance'],
      rows,
      summary
    });
  } catch (err) {
    console.error('Export bills error:', err);
    res.status(500).json({ message: 'Export failed' });
  }
});

// @desc    Single quotation PDF (for WhatsApp / email sending)
// @route   GET /api/export/quotes/:id/pdf
// @access  Private
router.get('/quotes/:id/pdf', protect, async (req, res) => {
  try {
    const q = await dbHelper.findById('Quotation', req.params.id);
    if (!q) return res.status(404).json({ message: 'Quotation not found' });
    if (req.user.role !== 'platform_owner' && q.clientId && String(q.clientId) !== String(req.user.clientId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const company = await resolveDocCompany(q);
    const platform = await getCompany();
    const buffer = await buildQuotationBuffer({
      quote: q,
      company,
      title: 'Renic Quotation',
      metaNo: 'Quotation No',
      footer: company.name,
      paymentDetails: platform.paymentDetails,
      termsConditions: platform.termsConditions
    });
    setDownload(res, `${q.quoteNumber || 'quotation'}.pdf`, 'application/pdf');
    res.send(buffer);
  } catch (err) {
    console.error('Quote PDF error:', err);
    res.status(500).json({ message: 'Failed to generate quotation PDF' });
  }
});

// @desc    Single invoice PDF (for WhatsApp / email sending)
// @route   GET /api/export/bills/:id/pdf
// @access  Private
router.get('/bills/:id/pdf', protect, async (req, res) => {
  try {
    const b = await dbHelper.findById('Bill', req.params.id);
    if (!b) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'platform_owner' && b.clientId && String(b.clientId) !== String(req.user.clientId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const company = await resolveDocCompany(b);
    const platform = await getCompany();
    const buffer = await buildQuotationBuffer({
      quote: b,
      company,
      title: 'Renic Invoice',
      metaNo: 'Invoice No',
      footer: company.name,
      payment: { method: b.paymentMethod, amountPaid: b.amountPaid, balanceDue: b.balanceDue },
      paymentDetails: platform.paymentDetails,
      termsConditions: platform.termsConditions
    });
    setDownload(res, `${b.invoiceNumber || 'invoice'}.pdf`, 'application/pdf');
    res.send(buffer);
  } catch (err) {
    console.error('Invoice PDF error:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF' });
  }
});

export default router;