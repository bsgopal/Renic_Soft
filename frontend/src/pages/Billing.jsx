import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const emptyItem = () => ({ name: '', description: '', hsnCode: '', qty: 1, unit: 'pcs', rate: 0, gstPercent: 0, discountPercent: 0, amount: 0 });

const DEFAULT_FORM = {
  clientId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  customerGSTIN: '',
  invoiceDate: '',
  dueDate: '',
  paymentMethod: 'Cash',
  amountPaid: 0,
  notes: '',
  items: [emptyItem()]
};

const computeTotals = (items) => {
  const subTotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const discountTotal = items.reduce((s, it) => s + ((it.qty * it.rate) * (it.discountPercent || 0)) / 100, 0);
  const taxTotal = items.reduce((s, it) => s + (((it.qty * it.rate) - ((it.qty * it.rate) * (it.discountPercent || 0)) / 100) * (it.gstPercent || 0)) / 100, 0);
  const grandTotal = subTotal - discountTotal + taxTotal;
  return { subTotal, discountTotal, taxTotal, grandTotal };
};

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];

export default function Billing() {
  const navigate = useNavigate();
  const { isPlatform = false } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const fromQuote = searchParams.get('fromQuote');

  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [quoteRef, setQuoteRef] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/bills');
      setBills(res.data);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isPlatform) api.get('/clients').then((res) => setClients(res.data)).catch(() => {});
  }, [isPlatform]);

  // Load quote to convert into invoice
  useEffect(() => {
    if (fromQuote) {
      api.get(`/quotes/${fromQuote}`)
        .then((res) => {
          const q = res.data;
          setQuoteRef(q);
          setForm({
            clientId: q.clientId || '',
            customerName: q.customerName || '',
            customerPhone: q.customerPhone || '',
            customerEmail: q.customerEmail || '',
            customerAddress: q.customerAddress || '',
            customerGSTIN: q.customerGSTIN || '',
            invoiceDate: today(),
            dueDate: '',
            paymentMethod: 'Cash',
            amountPaid: 0,
            notes: `Converted from ${q.quoteNumber}`,
            items: q.items?.length ? q.items.map((i) => ({ ...i })) : [emptyItem()]
          });
          setCreateOpen(true);
        })
        .catch(() => setQuoteRef(null));
    }
  }, [fromQuote]);

  const setItem = (idx, key, value) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const totals = useMemo(() => computeTotals(form.items), [form.items]);
  const balance = Math.max(totals.grandTotal - (form.amountPaid || 0), 0);

  const openCreate = () => {
    setQuoteRef(null);
    setForm({ ...DEFAULT_FORM, invoiceDate: today(), items: [emptyItem()] });
    setCreateOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, ...totals, quoteId: quoteRef?._id || null };
      const res = await api.post('/bills', payload);
      showSnackbar(res.data.message || 'Invoice created');
      setCreateOpen(false);
      if (fromQuote) setSearchParams({});
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (b) => {
    const automatic = b.grandTotal - (b.amountPaid || 0);
    if (automatic <= 0) return;
    const ok = await confirmDialog({
      title: `Record payment for ${b.invoiceNumber}?`,
      message: `Mark ${money(automatic)} as received from ${b.customerName || 'customer'}. The invoice will be settled.`,
      confirmText: 'Record Payment'
    });
    if (!ok) return;
    try {
      await api.put(`/bills/${b._id}`, { amountPaid: automatic });
      showSnackbar('Payment recorded — invoice marked as paid');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to record payment', 'error');
    }
  };

  const handleDelete = async (b) => {
    const ok = await confirmDialog({
      title: `Delete invoice ${b.invoiceNumber}?`,
      message: 'This will permanently remove the invoice and its line items. This action cannot be undone.',
      confirmText: 'Delete Invoice',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/bills/${b._id}`);
      showSnackbar('Invoice deleted successfully');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to delete invoice', 'error');
    }
  };

  const handleExport = async (format) => {
    const map = { Paid: 'paid', 'Partially Paid': 'pending', Unpaid: 'unpaid', Overdue: 'pending' };
    const filter = map[statusFilter] || 'all';
    try {
      await downloadFile(`/export/bills?filter=${filter}&format=${format}`, `billing-${filter}-${Date.now()}.${format}`);
      showSnackbar(`Invoice list exported as ${format.toUpperCase()}`);
    } catch (err) {
      showSnackbar('Export failed. Please try again.', 'error');
    }
  };

  // Generate the invoice PDF, save it locally, then open the customer's
  // WhatsApp chat so the PDF can be attached and sent.
  const handleWhatsApp = async (b) => {
    const raw = String(b.customerPhone || '').replace(/[^\d]/g, '');
    if (raw.length < 10) {
      showSnackbar('Add a customer phone number to send via WhatsApp', 'error');
      return;
    }
    let num = raw;
    if (num.startsWith('0')) num = num.slice(1);
    if (num.length === 10) num = '91' + num;
    try {
      showSnackbar('Generating invoice PDF...', 'info');
      await downloadFile(`/export/bills/${b._id}/pdf`, `${b.invoiceNumber || 'invoice'}.pdf`);
      let sign = '';
      try {
        const comp = await api.get('/settings/company');
        sign = comp.data.name || '';
      } catch (e) {}
      const msg = [
        `Dear ${b.customerName || 'Customer'},`,
        '',
        `Please find attached our invoice ${b.invoiceNumber}.`,
        '',
        `Total Amount: ${money(b.grandTotal)}`,
        `Balance Due: ${money(b.balanceDue || 0)}`,
        '',
        `Thank you,${sign ? `\n${sign}` : ''}`
      ].join('\n');
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err) {
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    }
  };

  const filtered = bills.filter((b) => {
    const q = String(b.invoiceNumber || '').toLowerCase() + String(b.customerName || '').toLowerCase();
    const matchSearch = q.includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const metrics = {
    revenue: bills.filter((b) => b.status === 'Paid').reduce((s, b) => s + (b.grandTotal || 0), 0),
    pending: bills.reduce((s, b) => s + (b.balanceDue || 0), 0),
    paid: bills.filter((b) => b.status === 'Paid').length,
    total: bills.length
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">Billing</h1>
          <p className="text-sm text-gray-500 mt-1">Create clean invoices, record payments and track balances</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('pdf')}>
            <Icon name="print" className="w-4 h-4" /> PDF
          </button>
          <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('xlsx')}>
            <Icon name="bill" className="w-4 h-4" /> Excel
          </button>
          <button className="btn-primary px-5 py-2.5" onClick={openCreate}>
            <Icon name="plus" className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Invoices</div>
          <div className="text-2xl font-semibold text-ink mt-1">{metrics.total}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</div>
          <div className="text-2xl font-semibold text-emerald-600 mt-1">{metrics.paid}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collected Revenue</div>
          <div className="text-2xl font-semibold text-ink mt-1">{money(metrics.revenue)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</div>
          <div className="text-2xl font-semibold text-amber-600 mt-1">{money(metrics.pending)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" className="w-4 h-4" /></span>
          <input className="input !pl-10" placeholder="Search by invoice # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['Draft', 'Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Invoice #</th>
                <th className="th">Customer</th>
                <th className="th">Date</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
                <th className="th">Status</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="td text-center py-10 text-gray-400">Loading invoices...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="td text-center py-10 text-gray-400">No invoices found.</td></tr>
              ) : filtered.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50/60">
                  <td className="td font-semibold text-brand-600">{b.invoiceNumber}</td>
                  <td className="td">
                    <div className="font-medium">{b.customerName || 'Walk-in Customer'}</div>
                    {b.customerPhone && <div className="text-xs text-gray-400">{b.customerPhone}</div>}
                  </td>
                  <td className="td text-xs text-gray-500">{new Date(b.invoiceDate).toLocaleDateString()}</td>
                  <td className="td text-right font-semibold">{money(b.grandTotal)}</td>
                  <td className="td text-right text-emerald-600">{money(b.amountPaid)}</td>
                  <td className="td text-right font-medium text-amber-600">{money(b.balanceDue)}</td>
                  <td className="td"><Badge value={b.status} /></td>
                  <td className="td text-center">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => handleWhatsApp(b)} className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600" title="Send via WhatsApp">
                        <Icon name="whatsapp" className="w-4 h-4" />
                      </button>
                      <button onClick={() => navigate(`/billing/${b._id}`)} className="p-1.5 rounded-full hover:bg-gray-100 text-brand-600" title="View / Print">
                        <Icon name="eye" className="w-4 h-4" />
                      </button>
                      {b.balanceDue > 0 && (
                        <button onClick={() => handleRecordPayment(b)} className="btn-primary !px-2.5 !py-1 !text-xs" title="Record full payment">
                          <Icon name="check" className="w-3.5 h-3.5" /> Collect
                        </button>
                      )}
                      <button onClick={() => handleDelete(b)} className="p-1.5 rounded-full hover:bg-gray-100 text-red-500" title="Delete">
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ New Invoice Modal ============ */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); if (fromQuote) setSearchParams({}); }}
        title={quoteRef ? `Invoice from ${quoteRef.quoteNumber}` : 'New Invoice'}
        maxWidth="max-w-4xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" form="billForm" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</button>
          </>
        }
      >
        <form id="billForm" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            {isPlatform && (
              <div className="sm:col-span-3">
                <label className="label">Store (Client) *</label>
                <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                  <option value="">Select store...</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
            </div>
            <div>
              <label className="label">Customer GSTIN</label>
              <input className="input" value={form.customerGSTIN} onChange={(e) => setForm({ ...form, customerGSTIN: e.target.value })} />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input className="input" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Split', 'Credit'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="card !rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Invoice Items</h4>
              <button type="button" className="btn-outline !px-3 !py-1.5 !text-xs" onClick={addItem}>
                <Icon name="plus" className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="th">Item / Description</th>
                    <th className="th !w-24">Qty</th>
                    <th className="th !w-24">Rate</th>
                    <th className="th !w-20">Disc %</th>
                    <th className="th !w-20">GST %</th>
                    <th className="th text-right">Amount</th>
                    <th className="th !w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => {
                    const gross = it.qty * it.rate;
                    const disc = (gross * (it.discountPercent || 0)) / 100;
                    const amt = gross - disc + ((gross - disc) * (it.gstPercent || 0)) / 100;
                    return (
                      <tr key={idx}>
                        <td className="td">
                          <input className="input !py-1.5 !text-xs" placeholder="Item name" value={it.name}
                            onChange={(e) => setItem(idx, 'name', e.target.value)} />
                          <input className="input !py-1.5 !text-xs mt-1" placeholder="Description / HSN" value={it.description}
                            onChange={(e) => setItem(idx, 'description', e.target.value)} />
                        </td>
                        <td className="td">
                          <input className="input !py-1.5 !text-xs" type="number" min="0" value={it.qty}
                            onChange={(e) => setItem(idx, 'qty', Number(e.target.value) || 0)} />
                        </td>
                        <td className="td">
                          <input className="input !py-1.5 !text-xs" type="number" min="0" step="0.01" value={it.rate}
                            onChange={(e) => setItem(idx, 'rate', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="td">
                          <input className="input !py-1.5 !text-xs" type="number" min="0" max="100" value={it.discountPercent}
                            onChange={(e) => setItem(idx, 'discountPercent', Number(e.target.value) || 0)} />
                        </td>
                        <td className="td">
                          <select className="input !py-1.5 !text-xs" value={it.gstPercent} onChange={(e) => setItem(idx, 'gstPercent', Number(e.target.value))}>
                            <option value={0}>0%</option><option value={5}>5%</option><option value={12}>12%</option>
                            <option value={18}>18%</option><option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="td text-right font-semibold whitespace-nowrap">{money(amt)}</td>
                        <td className="td text-center">
                          <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-full hover:bg-red-50 text-red-500" disabled={form.items.length === 1}>
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-3">
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount Paid</label>
                <input className="input" type="number" min="0" step="0.01" value={form.amountPaid}
                  onChange={(e) => setForm({ ...form, amountPaid: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="w-full sm:w-64 space-y-1.5 bg-gray-50 rounded-xl p-4 text-sm h-fit">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(totals.subTotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Discount</span><span>-{money(totals.discountTotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>+{money(totals.taxTotal)}</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-ink"><span>Total</span><span>{money(totals.grandTotal)}</span></div>
              <div className="flex justify-between font-semibold text-amber-600"><span>Balance Due</span><span>{money(balance)}</span></div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}