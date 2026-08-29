import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api.js';
import Badge from '../components/Badge.jsx';
import QuotationDoc from '../components/QuotationDoc.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function QuoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { client } = useAuth();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ paymentDetails: '', termsConditions: '' });

  useEffect(() => {
    api.get(`/quotes/${id}`)
      .then((res) => setQuote(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/settings/company')
      .then((res) => setSettings({ paymentDetails: res.data.paymentDetails || '', termsConditions: res.data.termsConditions || '' }))
      .catch(() => {});
  }, [id]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading quotation...</div>;
  if (!quote) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Quotation not found.</p>
      <Link to="/quotes" className="btn-primary">Back to Quotations</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <button className="btn-outline" onClick={() => navigate('/quotes')}>
          <Icon name="x" className="w-4 h-4" /> Close
        </button>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => window.print()}>
            <Icon name="print" className="w-4 h-4" /> Print / PDF
          </button>
          <button className="btn-primary" onClick={() => navigate(`/billing?fromQuote=${quote._id}`)}>
            <Icon name="bill" className="w-4 h-4" /> Convert to Invoice
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">{quote.quoteNumber}</h1>
        <Badge value={quote.status} />
      </div>

      <div className="card overflow-hidden">
        <QuotationDoc quote={quote} company={client} paymentDetails={settings.paymentDetails} termsConditions={settings.termsConditions} />
      </div>
    </div>
  );
}