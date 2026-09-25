import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api.js';
import Badge from '../components/Badge.jsx';
import InvoiceDoc from '../components/InvoiceDoc.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { client = null } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ paymentDetails: '', termsConditions: '' });

  useEffect(() => {
    api.get(`/bills/${id}`)
      .then((res) => setBill(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/settings/company')
      .then((res) => setSettings({ paymentDetails: res.data.paymentDetails || '', termsConditions: res.data.termsConditions || '' }))
      .catch(() => {});
  }, [id]);

  const collectPayment = async () => {
    const amount = (bill.balanceDue || 0);
    if (amount <= 0) return;
    const ok = await confirmDialog({
      title: `Collect payment of ₹${amount.toLocaleString('en-IN')}?`,
      message: `Mark ${bill.invoiceNumber} as fully paid for ${bill.customerName || 'customer'}.`,
      confirmText: 'Collect Payment'
    });
    if (!ok) return;
    try {
      await api.put(`/bills/${bill._id}`, { amountPaid: amount });
      const res = await api.get(`/bills/${bill._id}`);
      setBill(res.data);
      showSnackbar('Payment collected — invoice marked as paid');
    } catch (err) {
      showSnackbar('Failed to collect payment', 'error');
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading invoice...</div>;
  if (!bill) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Invoice not found.</p>
      <Link to="/billing" className="btn-primary">Back to Billing</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <button className="btn-outline" onClick={() => navigate('/billing')}>
          <Icon name="x" className="w-4 h-4" /> Close
        </button>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => window.print()}>
            <Icon name="print" className="w-4 h-4" /> Print / PDF
          </button>
          {bill.balanceDue > 0 && (
            <button className="btn-primary" onClick={collectPayment}>
              <Icon name="check" className="w-4 h-4" /> Collect Payment
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">{bill.invoiceNumber}</h1>
        <Badge value={bill.status} />
      </div>

      <div className="card overflow-hidden">
        <InvoiceDoc bill={bill} company={client} paymentDetails={settings.paymentDetails} termsConditions={settings.termsConditions} />
      </div>
    </div>
  );
}