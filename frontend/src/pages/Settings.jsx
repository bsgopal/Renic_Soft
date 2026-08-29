import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function Settings() {
  const { isPlatform } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', gst: '', paymentDetails: '', termsConditions: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/company')
      .then((res) => setForm({
        name: res.data.name || '',
        address: res.data.address || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        gst: res.data.gst || '',
        paymentDetails: res.data.paymentDetails || '',
        termsConditions: res.data.termsConditions || ''
      }))
      .catch(() => showSnackbar('Failed to load company settings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/settings/company', form);
      setForm(res.data.company);
      showSnackbar(res.data.message || 'Company settings saved');
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save company settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-ink">Company Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          This profile appears as the letterhead on every quotation and invoice PDF you send.
        </p>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading settings...</div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Company Name *</label>
              <input className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Renic Soft" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, State - PIN" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile / landline" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="billing@company.com" />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input className="input" value={form.gst}
                onChange={(e) => setForm({ ...form, gst: e.target.value.toUpperCase() })} placeholder="e.g. 29ABCDE1234F1Z5" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Payment Details (one per line)</label>
            <textarea className="input" rows={4} value={form.paymentDetails}
              onChange={(e) => setForm({ ...form, paymentDetails: e.target.value })}
              placeholder="Advance payment of 50% is required to confirm and begin the order.&#10;Balance amount to be paid upon delivery / completion.&#10;Accepted payment modes: Bank Transfer / UPI / Cheque / Card." />
            <p className="text-xs text-gray-400 mt-1">
              Shown under "Payment Terms" on quotations and "Payment Details" on invoices.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Terms &amp; Conditions (one per line)</label>
            <textarea className="input" rows={4} value={form.termsConditions}
              onChange={(e) => setForm({ ...form, termsConditions: e.target.value })}
              placeholder={'This quotation is valid for 14 days from the date of issue unless stated otherwise.\nPrices are subject to change without prior notice after the validity period.\nTaxes shown are as applicable on the date of this quotation.'} />
            <p className="text-xs text-gray-400 mt-1">
              Shown on quotations and invoices. When left blank, the reference texts are used automatically.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              <Icon name="store" className="w-3.5 h-3.5 inline mr-1" />
              Applied to PDFs for quotations and invoices without a linked store.
            </p>
            <button type="submit" className="btn-primary" disabled={saving || !isPlatform}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {!isPlatform && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Only the platform owner can edit these settings.
            </p>
          )}
        </form>
      )}
    </div>
  );
}