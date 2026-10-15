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

export default function QuotationDoc({ quote = {}, company = {}, paymentDetails = '', termsConditions = '', themeColor = '#84CC16' }) {
  const c = {
    companyName: company?.name || 'RENIC TECH',
    tagline: company?.tagline || 'AUTOMATION & CRM SOLUTIONS',
    phone: company?.contact || company?.phone || '+91 88070 25752',
    email: company?.email || 'info@renictechnology.com',
    website: company?.website || 'www.renictechnology.com',
    logoUrl: company?.logoUrl || logo
  };

  const color = themeColor || '#84CC16'; // Exact Renic Tech Lime Green
  const bgSoft = getAlphaColor(color, '12');
  const borderSoft = getAlphaColor(color, '30');
  const ribbonGradient = `linear-gradient(135deg, ${getAlphaColor(color, '12')} 0%, ${getAlphaColor(color, '25')} 50%, ${getAlphaColor(color, '40')} 100%)`;

  const titleText = quote.title || 'Custom Software Development';
  const titleParts = titleText.split(' ');
  const firstWord = titleParts.slice(0, Math.ceil(titleParts.length / 2)).join(' ');
  const accentWord = titleParts.slice(Math.ceil(titleParts.length / 2)).join(' ');

  const items = quote.items && quote.items.length ? quote.items : [];
  const defaultTerms = [
    '50% advance payment to start the project.',
    'Balance payment after final delivery.',
    'Timeline: 4 – 6 weeks (depends on features).',
    '1 year free support for the delivered project.',
    'Quotation is valid for 30 days.'
  ];

  return (
    <div
      id="print-area"
      className="bg-white p-6 sm:p-8 md:p-10 text-[13px] text-slate-800 leading-relaxed max-w-4xl mx-auto shadow-xs border border-slate-200 rounded-xl my-2"
      style={{ fontFamily: "'Inter', 'Segoe UI', -apple-system, sans-serif" }}
    >
      {/* 1. Header with Exact Renic Tech Logo on Left, Contact info on Right */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-6 mb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <img src={c.logoUrl} alt="Renic Tech Logo" className="h-16 sm:h-20 w-auto object-contain max-w-[280px] drop-shadow-xs" />
        </div>

        <div className="pl-4 space-y-1 text-xs text-slate-600 font-medium" style={{ borderLeft: `2.5px solid ${color}` }}>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>📞</span> {c.phone}
          </p>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>✉️</span> {c.email}
          </p>
          <p className="flex items-center gap-1.5 font-bold">
            <span style={{ color: color }}>🌐</span> {c.website}
          </p>
        </div>
      </div>

      {/* 2. Quotation Title & Meta Box */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">QUOTATION</span>
            <div className="w-10 h-0.5" style={{ backgroundColor: color }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-1">
            {firstWord} <span style={{ color: color }}>{accentWord}</span>
          </h2>
          <p className="text-xs text-slate-500 max-w-md">
            {quote.subtitle || 'A tailored solution to streamline your operations and support your business growth.'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl text-xs space-y-1.5 min-w-[220px]" style={{ backgroundColor: bgSoft, border: `1px solid ${borderSoft}` }}>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Quotation No</span>
            <b className="text-slate-900">: {quote.quoteNumber || 'RT/2026/091'}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Date</span>
            <span className="text-slate-900 font-bold">: {formatDateStr(quote.quoteDate || quote.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Valid Till</span>
            <span className="text-slate-900 font-bold">: {formatDateStr(quote.validUntil)}</span>
          </div>
        </div>
      </div>

      {/* 3. Customer To Block */}
      <div className="flex items-start gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: bgSoft, border: `1px solid ${borderSoft}`, color: color }}
        >
          🏢
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">To</span>
          <p className="text-base font-extrabold text-slate-900">{quote.customerName || 'ABC Enterprises'}</p>
          <p className="text-xs text-slate-600 max-w-lg mt-0.5">{quote.customerAddress || '123, Main Road, Tamil Nadu, India'}</p>
          {quote.customerPhone && <p className="text-xs text-slate-500 mt-0.5">Phone: {quote.customerPhone}</p>}
        </div>
      </div>

      {/* 4. Itemized Table with Solid Accent Header */}
      <div className="rounded-xl overflow-hidden border border-slate-200 mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: color, color: '#0F172A' }}>
              <th className="py-3 px-4 text-center font-black text-xs w-14">S.No</th>
              <th className="py-3 px-4 font-black text-xs">Project / Service</th>
              <th className="py-3 px-4 text-right font-black text-xs w-44">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                <td className="py-3 px-4 text-center text-slate-600 font-semibold text-xs border-b border-slate-100">
                  {idx + 1}
                </td>
                <td className="py-3 px-4 text-slate-900 font-bold text-xs border-b border-slate-100">
                  {it.name || it.item}
                  {it.description && <span className="block text-[11px] font-normal text-slate-500 mt-0.5">{it.description}</span>}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 font-extrabold text-xs border-b border-slate-100">
                  ₹ {(Number(it.amount) || ((Number(it.qty) || 1) * (Number(it.rate) || 0))).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr style={{ backgroundColor: bgSoft }}>
              <td colSpan={2} className="py-3.5 px-4 text-right font-black text-sm text-slate-900">
                Total Amount (INR)
              </td>
              <td
                className="py-3.5 px-4 text-right font-black text-base text-slate-950 tracking-wide"
                style={{ backgroundColor: color }}
              >
                ₹ {(Number(quote.grandTotal) || 0).toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Terms & Conditions Section */}
      <div className="mb-4">
        <h3 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: color }}>
          📄 Terms &amp; Conditions
        </h3>
        <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1 leading-relaxed">
          {quote.terms ? (
            quote.terms.split('\n').map((t, i) => <li key={i}>{t}</li>)
          ) : (
            defaultTerms.map((t, i) => <li key={i}>{t}</li>)
          )}
        </ul>
      </div>

      {/* 6. Dual Signature Section (Customer Acceptance & Service Provider) */}
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-end gap-6 mb-6">
        {/* Customer Acceptance & Signature Box */}
        <div
          className="flex-1 p-3.5 rounded-xl border border-dashed text-xs min-w-[260px]"
          style={{ backgroundColor: bgSoft, borderColor: borderSoft }}
        >
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 block mb-7">
            Customer Acceptance &amp; Signature
          </span>
          <div className="w-full h-px bg-slate-400 mb-1.5" />
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-bold text-slate-800">{quote.customerName || 'Authorized Signatory'}</span>
            <span className="text-slate-500 font-semibold">Date: ____________________</span>
          </div>
        </div>

        {/* Service Provider Signature */}
        <div className="text-center min-w-[200px] sm:self-end">
          <p className="text-2xl font-serif italic text-slate-800 leading-none mb-1" style={{ fontFamily: "'Dancing Script', 'Caveat', cursive" }}>
            Renic Team
          </p>
          <div className="w-36 h-0.5 mx-auto mb-1" style={{ backgroundColor: color }} />
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Authorized Signature</p>
          <p className="text-xs font-black text-slate-900 tracking-wide">{c.companyName}</p>
        </div>
      </div>

      {/* 7. Bottom Value Propositions Ribbon */}
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
