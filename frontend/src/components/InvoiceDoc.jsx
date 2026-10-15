import React from 'react';
import logo from '../assets/logo.png';

const getAlphaColor = (hex, opacityHex = '15') => {
  if (hex && hex.startsWith('#') && (hex.length === 7 || hex.length === 9)) {
    return `${hex.slice(0, 7)}${opacityHex}`;
  }
  return 'rgba(132, 204, 22, 0.12)';
};

const formatDateStr = (d) => {
  if (!d) return '';
  try {
    const parsed = new Date(d);
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
};

const money = (n) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceDoc({
  bill = {},
  company = {},
  paymentDetails = '',
  termsConditions = '',
  themeColor = '#84CC16'
}) {
  const c = {
    companyName: company?.name || 'RENIC TECH',
    tagline: company?.tagline || 'AUTOMATION & CRM SOLUTIONS',
    phone: company?.contact || company?.phone || '+91 88070 25752',
    email: company?.email || 'info@renictechnology.com',
    website: company?.website || 'www.renictechnology.com',
    address: company?.address || '123 Business Street, Suite 100, Tamil Nadu, India',
    gstin: company?.gstNumber || company?.gstin || '33XXXXX0000X0XX',
    logoUrl: company?.logoUrl || logo
  };

  const color = themeColor || '#84CC16'; // Exact Renic Tech Lime Green
  const bgSoft = getAlphaColor(color, '12');
  const borderSoft = getAlphaColor(color, '30');
  const ribbonGradient = `linear-gradient(135deg, ${getAlphaColor(color, '12')} 0%, ${getAlphaColor(color, '25')} 50%, ${getAlphaColor(color, '40')} 100%)`;

  const items = bill.items && bill.items.length ? bill.items : [];
  const gross = (it) => (Number(it.qty) || 1) * (Number(it.rate) || 0);

  const defaultTerms = [
    'Payment is due within the specified due date.',
    'Goods / services once delivered cannot be cancelled.',
    'Interest @ 18% p.a. will be charged for overdue payments beyond due date.',
    'Warranty / support valid as per signed service agreement.',
    'All disputes are subject to local jurisdiction only.'
  ];

  const defaultPayment = [
    `Payment Method: ${bill.paymentMethod || 'Bank Transfer / UPI'}`,
    'Accepted payment modes: IMPS / NEFT / RTGS / UPI / Card',
    'Please mention the Invoice Number in the payment remarks / reference.',
    'Account Name: RENIC TECH | IFSC: UTIB0000123 | A/C: 923020000000000'
  ];

  return (
    <div
      id="print-area"
      className="bg-white p-6 sm:p-8 md:p-10 text-[13px] text-slate-800 leading-relaxed max-w-4xl mx-auto shadow-xs border border-slate-200 rounded-xl my-2"
      style={{ fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif" }}
    >
      {/* 1. Header with Big, Sharp Renic Tech Logo on Left, Contact info on Right */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <img
            src={c.logoUrl}
            alt="Renic Tech Logo"
            className="h-16 sm:h-20 w-auto object-contain max-w-[280px] drop-shadow-xs"
          />
        </div>

        <div className="pl-4 space-y-1 text-xs text-slate-600 font-medium w-full sm:w-auto" style={{ borderLeft: `2.5px solid ${color}` }}>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>📞</span> {c.phone}
          </p>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>✉️</span> {c.email}
          </p>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>🌐</span> {c.website}
          </p>
          {c.gstin && (
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              GSTIN: <span className="text-slate-800 font-mono">{c.gstin}</span>
            </p>
          )}
        </div>
      </div>

      {/* 2. Document Title & Meta Box */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">TAX INVOICE</span>
            <div className="w-10 h-0.5" style={{ backgroundColor: color }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-1">
            Commercial <span style={{ color: color }}>Invoice</span>
          </h2>
          <p className="text-xs text-slate-500 max-w-md">
            {bill.notes || 'Official tax invoice for professional software services and technical solutions.'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl text-xs space-y-1.5 min-w-[230px]" style={{ backgroundColor: bgSoft, border: `1px solid ${borderSoft}` }}>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Invoice No</span>
            <b className="text-slate-900 font-mono">: {bill.invoiceNumber || 'INV/2026/001'}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Invoice Date</span>
            <span className="text-slate-900 font-bold">: {formatDateStr(bill.invoiceDate || bill.createdAt)}</span>
          </div>
          {bill.dueDate && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Due Date</span>
              <span className="text-slate-900 font-bold">: {formatDateStr(bill.dueDate)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
            <span className="text-slate-500 font-semibold">Payment Status</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                bill.status === 'Paid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : bill.status === 'Unpaid'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {bill.status || 'Unpaid'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bill To / Customer Box */}
      <div className="flex items-start gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: bgSoft, border: `1px solid ${borderSoft}`, color: color }}
        >
          🏢
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
          <p className="text-base font-extrabold text-slate-900">{bill.customerName || 'Customer / Client'}</p>
          {bill.customerAddress && <p className="text-xs text-slate-600 max-w-lg mt-0.5">{bill.customerAddress}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
            {bill.customerPhone && <span>Phone: <b className="text-slate-700">{bill.customerPhone}</b></span>}
            {bill.customerEmail && <span>Email: <b className="text-slate-700">{bill.customerEmail}</b></span>}
            {bill.customerGSTIN && <span>GSTIN: <b className="text-slate-700 font-mono">{bill.customerGSTIN}</b></span>}
          </div>
        </div>
      </div>

      {/* 4. Itemized Table with Solid Lime Accent Header */}
      <div className="rounded-xl overflow-hidden border border-slate-200 mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: color, color: '#0F172A' }}>
              <th className="py-3 px-3.5 text-center font-black text-xs w-12">S.No</th>
              <th className="py-3 px-3.5 font-black text-xs">Item Description</th>
              <th className="py-3 px-3.5 text-center font-black text-xs w-16">Qty</th>
              <th className="py-3 px-3.5 text-center font-black text-xs w-16">Unit</th>
              <th className="py-3 px-3.5 text-right font-black text-xs w-32">Rate (₹)</th>
              <th className="py-3 px-3.5 text-right font-black text-xs w-36">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                <td className="py-3 px-3.5 text-center text-slate-600 font-semibold text-xs border-b border-slate-100">
                  {idx + 1}
                </td>
                <td className="py-3 px-3.5 text-slate-900 font-bold text-xs border-b border-slate-100">
                  {it.name || it.item}
                  {it.description && <span className="block text-[11px] font-normal text-slate-500 mt-0.5">{it.description}</span>}
                  {it.hsnCode && <span className="block text-[10px] text-slate-400 font-mono mt-0.5">HSN: {it.hsnCode}</span>}
                </td>
                <td className="py-3 px-3.5 text-center text-slate-700 font-semibold text-xs border-b border-slate-100">
                  {it.qty || 1}
                </td>
                <td className="py-3 px-3.5 text-center text-slate-500 text-xs border-b border-slate-100">
                  {it.unit || 'Nos'}
                </td>
                <td className="py-3 px-3.5 text-right text-slate-800 font-semibold text-xs border-b border-slate-100">
                  ₹ {(Number(it.rate) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3.5 text-right text-slate-900 font-extrabold text-xs border-b border-slate-100">
                  ₹ {gross(it).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Totals Breakdown Card */}
      <div className="flex justify-end mb-6">
        <div className="w-full sm:w-80 rounded-xl border border-slate-200 overflow-hidden text-xs">
          <div className="flex justify-between px-3.5 py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Subtotal</span>
            <span className="font-bold text-slate-900">{money(bill.subTotal || gross({ qty: 1, rate: bill.grandTotal }))}</span>
          </div>

          {(bill.discountTotal > 0 || bill.discount > 0) && (
            <div className="flex justify-between px-3.5 py-2 border-b border-slate-100 text-emerald-700 font-semibold">
              <span>Discount</span>
              <span>-{money(bill.discountTotal || bill.discount)}</span>
            </div>
          )}

          {(bill.taxTotal > 0 || bill.taxRate > 0) && (
            <div className="flex justify-between px-3.5 py-2 border-b border-slate-100 text-slate-600">
              <span>GST / Tax Total</span>
              <span className="font-bold text-slate-900">+{money(bill.taxTotal || (bill.grandTotal * (bill.taxRate || 0) / 100))}</span>
            </div>
          )}

          <div className="flex justify-between px-3.5 py-2.5 font-black text-sm" style={{ backgroundColor: color, color: '#0F172A' }}>
            <span>GRAND TOTAL</span>
            <span className="font-black text-base">{money(bill.grandTotal)}</span>
          </div>

          {Number(bill.amountPaid || 0) > 0 && (
            <div className="flex justify-between px-3.5 py-2 border-b border-slate-100 text-slate-600">
              <span>Amount Paid</span>
              <span className="font-bold text-emerald-700">-{money(bill.amountPaid)}</span>
            </div>
          )}

          <div className="flex justify-between px-3.5 py-2 bg-amber-50/80 border-t border-amber-200 text-amber-900 font-black">
            <span>Balance Due</span>
            <span>{money(bill.balanceDue !== undefined ? bill.balanceDue : (bill.grandTotal - (bill.amountPaid || 0)))}</span>
          </div>
        </div>
      </div>

      {/* 6. Payment & Bank Information */}
      <div className="p-3.5 rounded-xl border border-slate-200 mb-5 text-xs bg-slate-50/70">
        <h3 className="font-black uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: color }}>
          💳 Payment Information
        </h3>
        <ul className="list-disc pl-5 text-slate-600 space-y-1">
          {paymentDetails ? (
            paymentDetails.split('\n').map((s) => s.trim()).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)
          ) : (
            defaultPayment.map((t, i) => <li key={i}>{t}</li>)
          )}
        </ul>
      </div>

      {/* 7. Terms & Conditions Section */}
      <div className="mb-6">
        <h3 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: color }}>
          📄 Terms &amp; Conditions
        </h3>
        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1 leading-relaxed">
          {termsConditions ? (
            termsConditions.split('\n').map((s) => s.trim()).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)
          ) : (
            defaultTerms.map((t, i) => <li key={i}>{t}</li>)
          )}
        </ul>
      </div>

      {/* 8. Dual Signature Section (Customer Acceptance & Service Provider) */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-end gap-6 mb-6">
        {/* Customer / Receiver Acceptance & Signature Box */}
        <div
          className="flex-1 p-3.5 rounded-xl border border-dashed text-xs min-w-[260px]"
          style={{ backgroundColor: bgSoft, borderColor: borderSoft }}
        >
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 block mb-7">
            Customer Acceptance &amp; Received In Good Condition
          </span>
          <div className="w-full h-px bg-slate-400 mb-1.5" />
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-bold text-slate-800">{bill.customerName || 'Receiver Signatory'}</span>
            <span className="text-slate-500 font-semibold">Date: ____________________</span>
          </div>
        </div>

        {/* Service Provider Authorized Signature */}
        <div className="text-center min-w-[200px] sm:self-end">
          <p className="text-2xl font-serif italic text-slate-800 leading-none mb-1" style={{ fontFamily: "'Dancing Script', 'Caveat', cursive" }}>
            Renic Team
          </p>
          <div className="w-36 h-0.5 mx-auto mb-1" style={{ backgroundColor: color }} />
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Authorized Signature</p>
          <p className="text-xs font-black text-slate-900 tracking-wide">{c.companyName}</p>
        </div>
      </div>

      {/* 9. Bottom Value Propositions Ribbon */}
      <div
        className="rounded-2xl p-3.5 flex flex-wrap justify-around items-center gap-3 border"
        style={{ background: ribbonGradient, borderColor: borderSoft }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg text-slate-950 flex items-center justify-center text-xs font-black shadow-xs" style={{ backgroundColor: color }}>
            ✓
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 leading-tight">Reliable</p>
            <p className="text-[10px] text-slate-600 font-semibold">Technology</p>
          </div>
        </div>

        <div className="hidden sm:block w-px h-6 bg-slate-300/60" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg text-slate-950 flex items-center justify-center text-xs font-black shadow-xs" style={{ backgroundColor: color }}>
            📊
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 leading-tight">Scalable</p>
            <p className="text-[10px] text-slate-600 font-semibold">Solutions</p>
          </div>
        </div>

        <div className="hidden sm:block w-px h-6 bg-slate-300/60" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg text-slate-950 flex items-center justify-center text-xs font-black shadow-xs" style={{ backgroundColor: color }}>
            👥
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 leading-tight">Long-Term</p>
            <p className="text-[10px] text-slate-600 font-semibold">Partnership</p>
          </div>
        </div>
      </div>
    </div>
  );
}
