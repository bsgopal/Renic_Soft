import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Badge from '../components/Badge.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import InvoiceDoc from '../components/InvoiceDoc.jsx';
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
  const subTotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (((Number(it.qty) || 0) * (Number(it.rate) || 0)) * (Number(it.discountPercent) || 0)) / 100, 0);
  const taxTotal = items.reduce((s, it) => s + ((((Number(it.qty) || 0) * (Number(it.rate) || 0)) - (((Number(it.qty) || 0) * (Number(it.rate) || 0)) * (Number(it.discountPercent) || 0)) / 100) * (Number(it.gstPercent) || 0)) / 100, 0);
  const grandTotal = subTotal - discountTotal + taxTotal;
  return { subTotal, discountTotal, taxTotal, grandTotal };
};

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];

export default function Billing() {
  const navigate = useNavigate();
  const { isPlatform = false } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [searchParams] = useSearchParams();
  const fromQuote = searchParams.get('fromQuote');

  const [bills, setBills] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Two-Column States
  const [selectedBill, setSelectedBill] = useState(null);
  const [mode, setMode] = useState(''); // '' | 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [splitPercent, setSplitPercent] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  const [form, setForm] = useState(DEFAULT_FORM);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/bills');
      const list = Array.isArray(res.data) ? res.data : [];
      setBills(list);
      // No auto-select: initial view is 1 column full width
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBill, mode, showSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isPlatform) api.get('/clients').then((res) => setClients(res.data)).catch(() => {});
  }, [isPlatform]);

  // Load quote to convert into invoice if query param exists
  useEffect(() => {
    if (fromQuote) {
      api.get(`/quotes/${fromQuote}`)
        .then((res) => {
          const q = res.data;
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
          setMode('create');
          setEditingId(null);
          setSelectedBill(null);
        })
        .catch(() => {});
    }
  }, [fromQuote]);

  const setItem = (idx, key, value) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, emptyItem()] });
  };

  const removeItem = (idx) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setSelectedBill(null);
    setForm({
      ...DEFAULT_FORM,
      invoiceDate: today(),
      items: [emptyItem()]
    });
  };

  const openEdit = (b) => {
    setSelectedBill(b);
    setMode('edit');
    setEditingId(b._id);
    const items = b.items?.length ? b.items.map(it => ({ ...it })) : [emptyItem()];
    setForm({
      clientId: b.clientId || '',
      customerName: b.customerName || '',
      customerPhone: b.customerPhone || '',
      customerEmail: b.customerEmail || '',
      customerAddress: b.customerAddress || '',
      customerGSTIN: b.customerGSTIN || '',
      invoiceDate: b.invoiceDate ? b.invoiceDate.split('T')[0] : today(),
      dueDate: b.dueDate ? b.dueDate.split('T')[0] : '',
      paymentMethod: b.paymentMethod || 'Cash',
      amountPaid: b.amountPaid || 0,
      notes: b.notes || '',
      items
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.items.length) {
      showSnackbar('Please add at least one item', 'error');
      return;
    }
    const cleanItems = form.items.map((it) => {
      const q = Number(it.qty) || 0;
      const r = Number(it.rate) || 0;
      const d = (q * r * (Number(it.discountPercent) || 0)) / 100;
      const t = ((q * r - d) * (Number(it.gstPercent) || 0)) / 100;
      return {
        name: it.name,
        description: it.description || '',
        hsnCode: it.hsnCode || '',
        qty: q,
        unit: it.unit || 'pcs',
        rate: r,
        discountPercent: Number(it.discountPercent) || 0,
        gstPercent: Number(it.gstPercent) || 0,
        amount: q * r - d + t
      };
    });

    const totals = computeTotals(cleanItems);
    const amtPaid = Number(form.amountPaid) || 0;
    const balanceDue = Math.max(0, totals.grandTotal - amtPaid);
    let status = 'Unpaid';
    if (amtPaid >= totals.grandTotal && totals.grandTotal > 0) status = 'Paid';
    else if (amtPaid > 0) status = 'Partially Paid';

    const payload = {
      clientId: form.clientId || undefined,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      customerAddress: form.customerAddress,
      customerGSTIN: form.customerGSTIN,
      invoiceDate: form.invoiceDate || today(),
      dueDate: form.dueDate || undefined,
      paymentMethod: form.paymentMethod,
      amountPaid: amtPaid,
      balanceDue,
      status,
      notes: form.notes,
      items: cleanItems,
      ...totals
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/bills/${editingId}`, payload);
        showSnackbar('Invoice updated successfully', 'success');
      } else {
        const res = await api.post('/bills', payload);
        showSnackbar('Invoice created successfully', 'success');
        if (res.data?._id) setEditingId(res.data._id);
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmDialog({
      title: 'Delete Invoice?',
      message: 'This will permanently remove the invoice and its line items.',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/bills/${id}`);
      showSnackbar('Invoice deleted successfully', 'success');
      if (editingId === id) {
        setMode('');
        setSelectedBill(null);
      }
      fetchData();
    } catch (err) {
      showSnackbar('Failed to delete invoice', 'error');
    }
  };

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
      showSnackbar('PDF ready. Opening WhatsApp...', 'success');
      window.open(`https://wa.me/${num}`, '_blank');
    } catch (err) {
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    }
  };

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      const q = String(b.invoiceNumber || '').toLowerCase() + String(b.customerName || '').toLowerCase();
      const matchSearch = q.includes(search.toLowerCase());
      const matchStatus = !statusFilter || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bills, search, statusFilter]);

  const currentTotals = computeTotals(form.items || []);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ LEFT COLUMN: INVOICE LIST TABLE (42% Width) ============ */}
      {!isPanelMaximized && (
        <div style={{ width: mode ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 200ms ease' }} className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0">
          {/* Top Control Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search invoice # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
            >
              <option value="">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> New Invoice
            </button>
          </div>

          {/* Subheader */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">Invoices ({filtered.length})</span>
            <span className="text-[11px] text-slate-400">Click row to open invoice studio</span>
          </div>

          {/* Invoice List Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Invoice # / Customer</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading invoices...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No invoices found</p>
                      <button onClick={openCreate} className="mt-2 text-xs font-bold text-[#65a30d] hover:underline">
                        + Create your first invoice
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => {
                    const isSelected = selectedBill?._id === b._id && mode;
                    return (
                      <tr
                        key={b._id}
                        onClick={() => openEdit(b)}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-lime-50/70 border-l-4 border-l-[#84cc16]'
                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Invoice # & Customer */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span className="text-[#65a30d]">{b.invoiceNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-700 font-medium truncate max-w-[170px] mt-0.5">
                            {b.customerName || 'Walk-in Customer'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(b.invoiceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-2 align-top text-right font-black text-slate-900">
                          {money(b.grandTotal)}
                          {b.balanceDue > 0 && (
                            <div className="text-[10px] text-rose-600 font-bold">Due: {money(b.balanceDue)}</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 align-top">
                          <Badge value={b.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleWhatsApp(b)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="Send WhatsApp"
                            >
                              <Icon name="whatsapp" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setSelectedBill(b); setEditingId(b._id); setMode("view"); }} className="p-1 text-slate-400 hover:text-[#65a30d] hover:bg-lime-50 rounded transition" title="View Invoice Studio">
                              <Icon name="eye" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(b._id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Delete"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Draggable Resizer */}
      {Boolean(mode) && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: INVOICE STUDIO & EDITOR ============ */}
      {Boolean(mode) && (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 flex-shrink-0 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          
          {/* 1. Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {mode === 'create' ? 'New Invoice' : (selectedBill?.invoiceNumber || 'Edit Invoice')}
                  </h2>
                  <Badge value={selectedBill?.status || 'Draft'} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Grand Total: <b className="text-slate-900 font-black">{money(currentTotals.grandTotal)}</b> · Items: <b className="text-slate-700">{form.items.length}</b>
                </p>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Invoice List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                {mode === 'view' && selectedBill && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(selectedBill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg transition shadow-xs"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" /> Edit Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/billing/${selectedBill._id}`)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Full Screen / Print View"
                    >
                      <Icon name="eye" className="w-4 h-4" />
                    </button>
                  </>
                )}
                {mode !== 'view' && editingId && (
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                  >
                    <Icon name="eye" className="w-3.5 h-3.5" /> View Mode
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title={isPanelMaximized ? "Restore Split View" : "Maximize Full View"}
                >
                  <Icon name="expand" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('')}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title="Close"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Scrollable Body: View Document OR Edit Form */}
          {mode === 'view' && selectedBill ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
              <InvoiceDoc bill={selectedBill} company={client} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60">
              <form onSubmit={handleSave} className="space-y-5 max-w-4xl">
              
              {/* Customer Information Card */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="store" className="w-3.5 h-3.5 text-[#65a30d]" /> Customer Profile &amp; Dates
                </h3>

                {isPlatform && clients.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Tenant Customer (Optional)</label>
                    <select
                      value={form.clientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        const c = clients.find((x) => x._id === cid);
                        setForm({
                          ...form,
                          clientId: cid,
                          customerName: c ? c.name : form.customerName,
                          customerPhone: c ? (c.contact || c.pendingOwnerMobile || '') : form.customerPhone,
                          customerEmail: c ? (c.ownerEmail || '') : form.customerEmail,
                          customerAddress: c ? (c.address || '') : form.customerAddress,
                          customerGSTIN: c ? (c.gstNumber || '') : form.customerGSTIN
                        });
                      }}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white"
                    >
                      <option value="">-- Direct / Walk-in Customer --</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.customerCode || c.subdomain})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Company Name *</label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      placeholder="e.g. Ramesh Traders"
                      required
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Phone (WhatsApp)</label>
                    <input
                      type="text"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={form.customerGSTIN}
                      onChange={(e) => setForm({ ...form, customerGSTIN: e.target.value.toUpperCase() })}
                      placeholder="33AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Credit Card">Credit / Debit Card</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Card */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="bill" className="w-3.5 h-3.5 text-emerald-600" /> Line Items &amp; Pricing
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#65a30d] hover:underline"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((it, idx) => {
                    const q = Number(it.qty) || 0;
                    const r = Number(it.rate) || 0;
                    const d = (q * r * (Number(it.discountPercent) || 0)) / 100;
                    const t = ((q * r - d) * (Number(it.gstPercent) || 0)) / 100;
                    const lineTotal = q * r - d + t;

                    return (
                      <div key={idx} className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-[11px]">Item #{idx + 1}</span>
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              placeholder="Product / Service Name *"
                              value={it.name}
                              onChange={(e) => setItem(idx, 'name', e.target.value)}
                              required
                              className="w-full px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              placeholder="Qty"
                              value={it.qty}
                              onChange={(e) => setItem(idx, 'qty', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs font-bold rounded border border-slate-300 bg-white text-center"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              placeholder="Rate (₹)"
                              value={it.rate}
                              onChange={(e) => setItem(idx, 'rate', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs font-bold rounded border border-slate-300 bg-white text-right"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <input
                              type="number"
                              placeholder="GST%"
                              value={it.gstPercent}
                              onChange={(e) => setItem(idx, 'gstPercent', e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white text-center"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-center justify-end font-black text-slate-900 text-xs">
                            {money(lineTotal)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Summary & Payment */}
                <div className="p-3 bg-slate-100 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <b className="text-slate-800">{money(currentTotals.subTotal)}</b>
                  </div>
                  {currentTotals.discountTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Discount:</span>
                      <b className="text-emerald-700">-{money(currentTotals.discountTotal)}</b>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">GST Tax:</span>
                    <b className="text-slate-800">+{money(currentTotals.taxTotal)}</b>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-300">
                    <span>Grand Total:</span>
                    <span>{money(currentTotals.grandTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-300">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (₹)</label>
                      <input
                        type="number"
                        value={form.amountPaid}
                        onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                        className="w-full px-2.5 py-1 text-xs font-bold rounded border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700 mb-1">Balance Due:</span>
                      <div className="text-sm font-black text-rose-600 py-1">
                        {money(Math.max(0, currentTotals.grandTotal - (Number(form.amountPaid) || 0)))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Invoice Notes &amp; Payment Instructions
                </h3>
                <textarea
                  rows={2}
                  placeholder="Payment bank details, UPI ID, terms..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </form>
          </div>
          )}

          {/* 3. Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setMode('')}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Invoice'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}