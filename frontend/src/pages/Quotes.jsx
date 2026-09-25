import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const emptyItem = () => ({ name: '', description: '', hsnCode: '', qty: '', unit: 'pcs', rate: '', gstPercent: 0, discountPercent: 0, amount: 0 });

const DEFAULT_FORM = {
  clientId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  customerGSTIN: '',
  validDate: '',
  notes: '',
  terms: '',
  status: 'draft',
  advanceDeposit: 0,
  items: [emptyItem()]
};

// Per-line calculation with safe coercion so empty qty/rate inputs compute as 0
const line = (it) => {
  const qty = Number(it.qty) || 0;
  const rate = Number(it.rate) || 0;
  const base = qty * rate;
  const disc = (base * (Number(it.discountPercent) || 0)) / 100;
  const tax = ((base - disc) * (Number(it.gstPercent) || 0)) / 100;
  return { base, disc, tax, total: base - disc + tax };
};

const computeTotals = (items) => items.reduce(
  (acc, it) => {
    const l = line(it);
    return {
      subTotal: acc.subTotal + l.base,
      discountTotal: acc.discountTotal + l.disc,
      taxTotal: acc.taxTotal + l.tax,
      grandTotal: acc.grandTotal + l.total
    };
  },
  { subTotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 }
);

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const in30d = () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

export default function Quotes() {
  const navigate = useNavigate();
  const { isPlatform = false } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mode, setMode] = useState(''); // 'create' | 'edit'
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotes');
      setQuotes(res.data);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isPlatform) api.get('/clients').then((res) => setClients(res.data)).catch(() => {});
  }, [isPlatform]);

  const setItem = (idx, key, value) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    const totals = computeTotals(items);
    setForm({ ...form, items, ...totals });
  };

  const addItem = () => {
    const items = [...form.items, emptyItem()];
    setForm({ ...form, items, ...computeTotals(items) });
  };

  const removeItem = (idx) => {
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items, ...computeTotals(items) });
  };

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, validDate: in30d(), items: [emptyItem()] });
  };

  const openEdit = (q) => {
    setMode('edit');
    setEditingId(q._id);
    setForm({
      clientId: q.clientId || '',
      customerName: q.customerName || '',
      customerPhone: q.customerPhone || '',
      customerEmail: q.customerEmail || '',
      customerAddress: q.customerAddress || '',
      customerGSTIN: q.customerGSTIN || '',
      validDate: q.validUntil ? q.validUntil.split('T')[0] : in30d(),
      notes: q.notes || '',
      terms: q.terms || '',
      status: q.status,
      advanceDeposit: q.advanceDeposit || 0,
      items: q.items?.length ? q.items.map((i) => ({ ...i })) : [emptyItem()]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'create') {
        const res = await api.post('/quotes', form);
        showSnackbar(res.data.message || 'Quotation created');
      } else {
        await api.put(`/quotes/${editingId}`, form);
        showSnackbar('Quotation updated');
      }
      setMode('');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save quotation', 'error');
    }
  };

  const handleStatusQuick = async (q, status) => {
    try {
      await api.put(`/quotes/${q._id}`, { status });
      showSnackbar(`Quotation marked ${status}`);
      fetchData();
    } catch (err) {
      showSnackbar('Failed to update status', 'error');
    }
  };

  const handleDelete = async (q) => {
    const ok = await confirmDialog({
      title: `Delete quotation ${q.quoteNumber}?`,
      message: 'This will permanently remove the quotation and its line items. This action cannot be undone.',
      confirmText: 'Delete Quotation',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/quotes/${q._id}`);
      showSnackbar('Quotation deleted successfully');
      fetchData();
    } catch (err) {
      showSnackbar('Failed to delete quotation', 'error');
    }
  };

  const filtered = quotes.filter((q) => {
    const matchSearch =
      String(q.quoteNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      String(q.customerName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totals = computeTotals(form.items);

  const handleExport = async (format) => {
    try {
      await downloadFile(`/export/quotes?format=${format}`, `quotations-${Date.now()}.${format}`);
      showSnackbar(`Quotation list exported as ${format.toUpperCase()}`);
    } catch (err) {
      showSnackbar('Export failed. Please try again.', 'error');
    }
  };

  // Generate the quotation PDF and save it, then open the customer's WhatsApp
  // chat (empty, no pre-filled text) so the real PDF can be attached and sent.
  const handleWhatsApp = async (q) => {
    const raw = String(q.customerPhone || '').replace(/[^\d]/g, '');
    if (raw.length < 10) {
      showSnackbar('Add a customer phone number to send via WhatsApp', 'error');
      return;
    }
    let num = raw;
    if (num.startsWith('0')) num = num.slice(1);
    if (num.length === 10) num = '91' + num;
    try {
      showSnackbar('Saving quotation PDF...', 'info');
      await downloadFile(`/export/quotes/${q._id}/pdf`, `${q.quoteNumber || 'quotation'}.pdf`);
      showSnackbar('PDF saved. Attach it in WhatsApp and send.', 'success');
      window.open(`https://wa.me/${num}`, '_blank');
    } catch (err) {
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">Create professional quotations and convert them to invoices</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('pdf')}>
            <Icon name="print" className="w-4 h-4" /> PDF
          </button>
          <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('xlsx')}>
            <Icon name="bill" className="w-4 h-4" /> Excel
          </button>
          <button className="btn-primary px-5 py-2.5" onClick={openCreate}>
            <Icon name="plus" className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" className="w-4 h-4" /></span>
          <input className="input !pl-10" placeholder="Search by number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['draft', 'sent', 'accepted', 'converted', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Quote #</th>
                <th className="th">Customer</th>
                <th className="th">Date / Valid Until</th>
                <th className="th">Items</th>
                <th className="th text-right">Amount</th>
                <th className="th">Status</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="td text-center py-10 text-gray-400">Loading quotations...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center py-10 text-gray-400">No quotations found.</td></tr>
              ) : filtered.map((q) => (
                <tr key={q._id} className="hover:bg-gray-50/60">
                  <td className="td font-semibold text-brand-600">{q.quoteNumber}</td>
                  <td className="td">
                    <div className="font-medium">{q.customerName || 'Walk-in Customer'}</div>
                    {q.customerPhone && <div className="text-xs text-gray-400">{q.customerPhone}</div>}
                  </td>
                  <td className="td text-xs text-gray-500">
                    <div>{new Date(q.quoteDate).toLocaleDateString()}</div>
                    <div>Valid till {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="td">{q.items?.length || 0}</td>
                  <td className="td text-right font-semibold">{money(q.grandTotal)}</td>
                  <td className="td"><Badge value={q.status} /></td>
                  <td className="td text-center">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => handleWhatsApp(q)} className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600" title="Send via WhatsApp">
                        <Icon name="whatsapp" className="w-4 h-4" />
                      </button>
                      <button onClick={() => navigate(`/quotes/${q._id}`)} className="p-1.5 rounded-full hover:bg-gray-100 text-brand-600" title="View / Print">
                        <Icon name="eye" className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(q)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500" title="Edit">
                        <Icon name="edit" className="w-4 h-4" />
                      </button>
                      {q.status === 'draft' && (
                        <button onClick={() => handleStatusQuick(q, 'sent')} className="p-1.5 rounded-full hover:bg-gray-100 text-blue-600" title="Mark Sent">
                          <Icon name="check" className="w-4 h-4" />
                        </button>
                      )}
                      {q.status !== 'converted' && (
                        <button onClick={() => navigate(`/billing?fromQuote=${q._id}`)} className="btn-primary !px-2.5 !py-1 !text-xs" title="Convert to Invoice">
                          <Icon name="bill" className="w-3.5 h-3.5" /> Invoice
                        </button>
                      )}
                      <button onClick={() => handleDelete(q)} className="p-1.5 rounded-full hover:bg-gray-100 text-red-500" title="Delete">
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

      {/* ============ Create / Edit Quotation ============ */}
      <Modal
        open={!!mode}
        onClose={() => setMode('')}
        title={mode === 'create' ? 'New Quotation' : 'Edit Quotation'}
        maxWidth="max-w-5xl"
        footer={
          <>
            <button className="btn-outline" onClick={() => setMode('')}>Cancel</button>
            <button type="submit" form="quoteForm" className="btn-primary">{mode === 'create' ? 'Create Quotation' : 'Save Changes'}</button>
          </>
        }
      >
        <form id="quoteForm" onSubmit={handleSubmit} className="space-y-5">
          {/* ---------- Customer Details ---------- */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Customer Details</h4>
            {isPlatform && (
              <div>
                <label className="label">Store (Client) *</label>
                <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                  <option value="">Select store...</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
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
              <div>
                <label className="label">Customer GSTIN</label>
                <input className="input" value={form.customerGSTIN} onChange={(e) => setForm({ ...form, customerGSTIN: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input className="input" value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
              </div>
              <div>
                <label className="label">Valid Until</label>
                <input className="input" type="date" value={form.validDate} onChange={(e) => setForm({ ...form, validDate: e.target.value })} />
              </div>
              <div>
                <label className="label">Advance / Deposit Required (₹)</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.advanceDeposit} onChange={(e) => setForm({ ...form, advanceDeposit: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['draft', 'sent', 'accepted', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ---------- Line Items ---------- */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Line Items</h4>
              <button type="button" className="btn-outline !px-3 !py-1.5 !text-xs" onClick={addItem}>
                <Icon name="plus" className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {form.items.map((it, idx) => (
              <div key={idx} className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="label">Item Name *</label>
                    <input className="input" placeholder="e.g. POS Software License"
                      value={it.name} onChange={(e) => setItem(idx, 'name', e.target.value)} />
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="mt-6 p-2 rounded-lg hover:bg-red-50 text-red-500" disabled={form.items.length === 1} title="Remove item">
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="label">Description / HSN Code</label>
                  <input className="input" placeholder="Short description or HSN code"
                    value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="label">Qty</label>
                    <input className="input" type="number" min="0" placeholder="0"
                      value={it.qty} onChange={(e) => setItem(idx, 'qty', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <select className="input" value={it.unit} onChange={(e) => setItem(idx, 'unit', e.target.value)}>
                      <option value="pcs">Pcs</option>
                      <option value="nos">Nos</option>
                      <option value="set">Set</option>
                      <option value="day">Day</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                      <option value="ltr">Ltr</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Rate (₹)</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                      value={it.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Disc %</label>
                    <input className="input" type="number" min="0" max="100" placeholder="0"
                      value={it.discountPercent} onChange={(e) => setItem(idx, 'discountPercent', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">GST %</label>
                    <select className="input" value={it.gstPercent} onChange={(e) => setItem(idx, 'gstPercent', Number(e.target.value))}>
                      <option value={0}>0%</option><option value={5}>5%</option><option value={12}>12%</option>
                      <option value={18}>18%</option><option value={28}>28%</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Line Amount</span>
                  <span className="font-semibold text-ink">{money(line(it).total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ---------- Notes / Terms + Totals ---------- */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-3">
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div>
                <label className="label">Terms &amp; Conditions</label>
                <textarea className="input" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
              </div>
            </div>
            <div className="w-full sm:w-64 space-y-1.5 bg-gray-50 rounded-xl p-4 text-sm h-fit">
              <div className="flex justify-between text-gray-500"><span>Sub Total</span><span>{money(totals.subTotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Discount</span><span>-{money(totals.discountTotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>+{money(totals.taxTotal)}</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-ink text-base">
                <span>Total</span><span>{money(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
