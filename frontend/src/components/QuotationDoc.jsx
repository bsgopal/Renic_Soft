import React from 'react';

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const COMPANY = {
  name: 'Renic Soft Technologies',
  address: '123 Business Street, Suite 100, City, State, PIN',
  phone: '+91 00000 00000',
  email: 'contacts@renicsoft.in',
  website: 'www.renicsoft.in',
  gstin: '00XXXXX0000X0XX'
};

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1.5">{children}</p>
);

export default function QuotationDoc({ quote = {}, company, paymentDetails = '', termsConditions = '' }) {
  const c = company ? { ...COMPANY, ...company } : COMPANY;
  const sellerPhone = company?.contact || c.phone;
  const sellerAddress = company?.address || c.address;
  const sellerGstin = company?.gstNumber || c.gstin;
  const gross = (it) => (it.qty || 0) * (it.rate || 0);
  const balance = (quote.grandTotal || 0) - (quote.advanceDeposit || 0);

  return (
    <div id="print-area" className="bg-white p-8 md:p-10 text-[13px] text-ink leading-relaxed">
      {/* ===== Company letterhead ===== */}
      <div className="text-center border-b-4 border-double border-brand-500 pb-4">
        <h1 className="text-2xl tracking-wide font-bold">{c.name}</h1>
        <p className="text-[11px] text-gray-600 mt-1">{sellerAddress}</p>
        <p className="text-[11px] text-gray-600">
          Phone: {sellerPhone || '—'} &nbsp;|&nbsp; Email: {c.email} &nbsp;|&nbsp; {c.website}
        </p>
        <p className="text-[11px] text-gray-600">
          {c.website} &nbsp;|&nbsp; GSTIN/Tax ID: {sellerGstin}
        </p>
      </div>

      {/* ===== Title + meta ===== */}
      <div className="flex flex-wrap justify-between items-end mt-6 gap-4">
        <div className="border-2 border-gray-300 rounded-lg px-8 py-3">
          <span className="text-2xl font-bold tracking-[0.3em] text-gray-800">QUOTATION</span>
        </div>
        <div className="text-sm space-y-1">
          <p><span className="text-gray-500">Quotation No:</span> <b>{quote.quoteNumber}</b></p>
          <p><span className="text-gray-500">Date:</span> {fmt(quote.quoteDate)}</p>
          <p><span className="text-gray-500">Valid Until:</span> {quote.validUntil ? fmt(quote.validUntil) : '—'}</p>
        </div>
      </div>

      {/* ===== Quotation To / Prepared By ===== */}
      <div className="grid grid-cols-2 gap-8 mt-6">
        <div>
          <SectionLabel>Quotation To</SectionLabel>
          <p className="font-semibold">{quote.customerName || '—'}</p>
          {quote.customerAddress && <p className="text-gray-600">{quote.customerAddress}</p>}
          {quote.customerPhone && <p className="text-gray-600">{quote.customerPhone}</p>}
          {quote.customerEmail && <p className="text-gray-600">{quote.customerEmail}</p>}
          {quote.customerGSTIN && <p className="text-gray-600">GSTIN: {quote.customerGSTIN}</p>}
        </div>
        <div className="text-right">
          <SectionLabel>Prepared By</SectionLabel>
          <p className="font-semibold">Sales Representative</p>
          <p className="text-gray-600">Sales Team</p>
          <p className="text-gray-600">{c.email}</p>
        </div>
      </div>

      {/* Project/Subject */}
      <div className="mt-5">
        <SectionLabel>Project / Subject</SectionLabel>
        <p className="text-gray-800">Quotation for goods &amp; services as detailed below</p>
        {quote.notes && <p className="text-xs text-gray-500">Refer: {quote.notes}</p>}
      </div>

      {/* ===== Items table ===== */}
      <table className="w-full mt-5 border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left text-[11px] uppercase text-gray-600">
            <th className="px-3 py-2.5 border border-gray-200 w-12">S.No</th>
            <th className="px-3 py-2.5 border border-gray-200">Item Description</th>
            <th className="px-3 py-2.5 border border-gray-200 text-center w-14">Qty</th>
            <th className="px-3 py-2.5 border border-gray-200 text-center w-14">Unit</th>
            <th className="px-3 py-2.5 border border-gray-200 text-right w-28">Unit Price</th>
            <th className="px-3 py-2.5 border border-gray-200 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5 border border-gray-100 text-center text-gray-500">{i + 1}</td>
              <td className="px-3 py-2.5 border border-gray-100">
                <span className="font-medium">{it.name}</span>
                {it.description && <span className="block text-xs text-gray-500">{it.description}</span>}
                {it.hsnCode && <span className="block text-[10px] text-gray-400">HSN: {it.hsnCode}</span>}
              </td>
              <td className="px-3 py-2.5 border border-gray-100 text-center">{it.qty}</td>
              <td className="px-3 py-2.5 border border-gray-100 text-center">{it.unit || 'Nos'}</td>
              <td className="px-3 py-2.5 border border-gray-100 text-right">{money(it.rate)}</td>
              <td className="px-3 py-2.5 border border-gray-100 text-right font-medium">{money(gross(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Totals ===== */}
      <div className="flex justify-end mt-5">
        <div className="w-72 space-y-1">
          <div className="flex justify-between px-3 py-1.5"><span>Subtotal</span><span>{money(quote.subTotal)}</span></div>
          <div className="flex justify-between px-3 py-1.5"><span>Discount</span><span>-{money(quote.discountTotal)}</span></div>
          <div className="flex justify-between px-3 py-1.5"><span>Tax (GST/VAT %)</span><span>+{money(quote.taxTotal)}</span></div>
          <div className="flex justify-between px-3 py-2 bg-gray-800 text-white font-bold">
            <span>TOTAL</span><span>{money(quote.grandTotal)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 text-gray-600"><span>Advance / Deposit Required</span><span>{money(quote.advanceDeposit || 0)}</span></div>
          <div className="flex justify-between px-3 py-2 bg-amber-50 border border-amber-200 font-bold text-amber-800">
            <span>Balance Due</span><span>{money(balance)}</span>
          </div>
        </div>
      </div>

      {/* ===== Payment terms ===== */}
      <div className="mt-6">
        <SectionLabel>Payment Terms</SectionLabel>
        <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-gray-700">
          {paymentDetails.split('\n').map((s) => s.trim()).filter(Boolean).length ? (
            paymentDetails.split('\n').map((s) => s.trim()).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)
          ) : (
            <>
              <li>Advance payment of 50% is required to confirm and begin the order.</li>
              <li>Balance amount to be paid upon delivery / completion.</li>
              <li>Accepted payment modes: Bank Transfer / UPI / Cheque / Card.</li>
            </>
          )}
        </ul>
      </div>

      {/* ===== Terms ===== */}
      <div className="mt-4">
        <SectionLabel>Terms &amp; Conditions</SectionLabel>
        <ul className="list-disc pl-5 space-y-0.5 text-[12px] text-gray-700">
          {termsConditions.split('\n').map((s) => s.trim()).filter(Boolean).length ? (
            termsConditions.split('\n').map((s) => s.trim()).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)
          ) : (
            <>
              <li>This quotation is valid for 14 days from the date of issue unless stated otherwise.</li>
              <li>Prices are subject to change without prior notice after the validity period.</li>
              <li>Taxes shown are as applicable on the date of this quotation.</li>
            </>
          )}
        </ul>
      </div>

      {/* ===== Signature ===== */}
      <div className="grid grid-cols-2 gap-10 mt-10">
        <div>
          <SectionLabel>Authorized Signature</SectionLabel>
          <div className="h-16" />
          <div className="border-t border-gray-300 pt-1.5 text-xs">For {c.name}</div>
        </div>
        <div>
          <SectionLabel>Customer Acceptance &amp; Signature</SectionLabel>
          <div className="h-16" />
          <div className="border-t border-gray-300 pt-1.5 text-xs">Customer Signature</div>
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-gray-400 italic">
        Thank you for considering {c.name}. We look forward to working with you.
      </p>
    </div>
  );
}