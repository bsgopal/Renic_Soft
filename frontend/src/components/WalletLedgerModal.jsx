import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import Modal from './Modal.jsx';
import { Icon } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function WalletLedgerModal({ isOpen, onClose, client, onWalletUpdated }) {
  const { user, isSuperAdmin } = useAuth() || {};
  const { showSnackbar } = useSnackbar() || { showSnackbar: () => {} };

  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 30, pages: 1 });

  // Filters
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals inside studio
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // Recharge Form State
  const [rechargeAmount, setRechargeAmount] = useState('2000');
  const [calculatorMode, setCalculatorMode] = useState('AMOUNT'); // 'AMOUNT' or 'MESSAGES'
  const [targetMessages, setTargetMessages] = useState('2222');
  const [customRate, setCustomRate] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [rechargeNotes, setRechargeNotes] = useState('');
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [gstInclusive, setGstInclusive] = useState(true);
  const [submittingRecharge, setSubmittingRecharge] = useState(false);

  // Rate Form State
  const [newRateInput, setNewRateInput] = useState('0.90');
  const [submittingRate, setSubmittingRate] = useState(false);

  // Bypass Toggle State
  const [togglingBypass, setTogglingBypass] = useState(false);

  const fetchLedger = useCallback(async (page = 1) => {
    if (!client?._id) return;
    try {
      setLoading(true);
      const params = {
        page,
        limit: 30,
        type: filterType,
        search: searchQuery
      };
      const res = await api.get(`/wallet/${client._id}/ledger`, { params });
      if (res.data?.success) {
        setWallet(res.data.wallet);
        setTransactions(res.data.transactions || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 30, pages: 1 });
        setNewRateInput(String(res.data.wallet?.messageRate || '0.90'));
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to fetch wallet ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [client?._id, filterType, searchQuery, showSnackbar]);

  useEffect(() => {
    if (isOpen && client?._id) {
      fetchLedger(1);
    }
  }, [isOpen, client?._id, fetchLedger]);

  // Handle Recharge Submit
  const handleRechargeSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(rechargeAmount);
    if (!amountNum || amountNum <= 0) {
      showSnackbar('Please enter a valid recharge amount', 'warning');
      return;
    }

    try {
      setSubmittingRecharge(true);
      const payload = {
        amount: amountNum,
        ratePerMessage: customRate ? parseFloat(customRate) : (wallet?.messageRate || 0.90),
        paymentMode,
        referenceId,
        description: rechargeNotes,
        generateInvoice,
        gstInclusive,
        actor: {
          userId: user?._id || 'SUPER_ADMIN',
          name: user?.name || 'Super Admin',
          mobile: user?.mobile || '9345578103',
          role: user?.role || 'SUPER_ADMIN'
        }
      };

      const res = await api.post(`/wallet/${client._id}/recharge`, payload);
      if (res.data?.success) {
        showSnackbar(res.data.message || 'Recharge successful!', 'success');
        setShowRechargeModal(false);
        setReferenceId('');
        setRechargeNotes('');
        fetchLedger(1);
        if (onWalletUpdated) onWalletUpdated();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to process wallet recharge', 'error');
    } finally {
      setSubmittingRecharge(false);
    }
  };

  // Handle Rate Update Submit
  const handleRateSubmit = async (e) => {
    e.preventDefault();
    const rateNum = parseFloat(newRateInput);
    if (!rateNum || rateNum <= 0) {
      showSnackbar('Please enter a valid rate (e.g. 0.90)', 'warning');
      return;
    }

    try {
      setSubmittingRate(true);
      const res = await api.put(`/wallet/${client._id}/rate`, {
        rate: rateNum,
        actor: {
          userId: user?._id,
          name: user?.name,
          mobile: user?.mobile,
          role: user?.role
        }
      });
      if (res.data?.success) {
        showSnackbar(res.data.message, 'success');
        setShowRateModal(false);
        fetchLedger(1);
        if (onWalletUpdated) onWalletUpdated();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update message rate', 'error');
    } finally {
      setSubmittingRate(false);
    }
  };

  // Handle Super Admin Bypass Toggle (Send Without Money)
  const handleBypassToggle = async () => {
    if (!isSuperAdmin) {
      showSnackbar('Unauthorized: Only Super Admin (9345578103) can toggle Send Without Money', 'error');
      return;
    }

    const currentBypass = !!wallet?.allowWithoutBalance;
    const actionText = currentBypass
      ? 'DISABLE "Send Without Money" (Prepaid wallet balance will be required)?'
      : 'ENABLE "Send Without Money" (Client can send messages with Rs 0 balance)? All messages will still be tracked!';

    if (!window.confirm(`Are you sure you want to ${actionText}`)) {
      return;
    }

    try {
      setTogglingBypass(true);
      const res = await api.put(`/wallet/${client._id}/bypass-toggle`, {
        allowWithoutBalance: !currentBypass,
        actor: {
          userId: user?._id,
          name: user?.name || 'Super Admin',
          mobile: user?.mobile || '9345578103',
          role: 'SUPER_ADMIN'
        }
      });

      if (res.data?.success) {
        showSnackbar(res.data.message, 'success');
        fetchLedger(1);
        if (onWalletUpdated) onWalletUpdated();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to toggle bypass mode', 'error');
    } finally {
      setTogglingBypass(false);
    }
  };

  // Export to CSV
  const exportLedgerCsv = () => {
    if (!transactions.length) {
      showSnackbar('No transactions to export', 'warning');
      return;
    }

    const headers = [
      'Timestamp (IST)',
      'Transaction Type',
      'Amount (INR)',
      'Rate Per Message',
      'Messages',
      'Balance After',
      'Messages Left',
      'Payment Mode',
      'Reference ID',
      'Performed By',
      'Description'
    ];

    const rows = transactions.map((t) => [
      `"${t.formattedTimestamp || t.createdAt}"`,
      `"${t.transactionType}"`,
      t.amount,
      t.ratePerMessage,
      t.messagesCount,
      t.balanceAfter,
      t.messagesAfter,
      `"${t.paymentMode || ''}"`,
      `"${t.referenceId || ''}"`,
      `"${t.performedBy?.name || ''} (${t.performedBy?.mobile || t.performedBy?.role || ''})"`,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wallet-ledger-${client.customerCode || 'client'}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const currentRate = wallet?.messageRate || 0.90;
  const currentBalance = wallet?.balance || 0;
  const availableMessages = currentRate > 0 ? Math.floor(currentBalance / currentRate) : 0;
  const isBypassActive = !!wallet?.allowWithoutBalance;

  // Dynamic preview for recharge modal
  const rechargePreviewAmount = parseFloat(rechargeAmount) || 0;
  const activeCalcRate = customRate ? parseFloat(customRate) : currentRate;
  const previewMessages = activeCalcRate > 0 ? Math.floor(rechargePreviewAmount / activeCalcRate) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Studio Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
              💳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  WhatsApp Prepaid Wallet & Message Credit Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {client?.name} ({client?.customerCode || 'Tenant'})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enterprise real-time balance consumption, credit provisioning & financial audit ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLedgerCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              title="Export ledger to CSV"
            >
              <Icon name="download" className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Top 4 Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Card 1: Balance & Messages Available */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Wallet Balance
                </span>
                <span className="text-lg">💰</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>≈ {availableMessages.toLocaleString('en-IN')} messages left</span>
              </div>
            </div>

            {/* Card 2: Active Rate Per Message */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Message Rate
                </span>
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowRateModal(true)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Edit Rate
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{Number(currentRate).toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">/ message</span>
              </div>
              <div className="mt-1 text-xs text-slate-400 truncate">
                {Math.round(currentRate * 100)} paise per outbound dispatch
              </div>
            </div>

            {/* Card 3: Dispatch Policy / Super Admin Bypass Mode */}
            <div className={`p-4 rounded-xl border relative ${
              isBypassActive
                ? 'border-amber-400/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Dispatch Policy
                </span>
                <span className="text-sm">{isBypassActive ? '⚡' : '🛡️'}</span>
              </div>
              <div className="mt-2">
                {isBypassActive ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                    ⚡ Send Without Money (Active)
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    🛡️ Strict Prepaid Balance
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {isBypassActive
                  ? 'Bypass gate active; sends without wallet money'
                  : 'Requires wallet balance >= message count'}
              </p>
            </div>

            {/* Card 4: Lifetime Recharged & Consumed */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Lifetime Stats
                </span>
                <span className="text-sm">📊</span>
              </div>
              <div className="mt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recharged:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{Number(wallet?.totalRecharged || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Messages Sent:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {(wallet?.totalMessagesSent || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Super Admin Control Bar & Action Buttons */}
          <div className="p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600 text-white">
                <Icon name="key" className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Super Admin WhatsApp Wallet Governance
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Authorize instant wallet top-ups, adjust dynamic message pricing, or bypass zero-balance blocks.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Super Admin Exclusive Bypass Toggle */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleBypassToggle}
                  disabled={togglingBypass}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                    isBypassActive
                      ? 'bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-400'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title="Super Admin Only: Allow sending messages without adding money"
                >
                  <span>⚡</span>
                  {togglingBypass
                    ? 'Updating...'
                    : isBypassActive
                    ? 'Disable "Send Without Money"'
                    : 'Allow "Send Without Money"'}
                </button>
              )}

              {/* Add Money / Recharge Button */}
              <button
                type="button"
                onClick={() => setShowRechargeModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <span>➕</span> Add Money to Wallet
              </button>
            </div>
          </div>

          {/* Ledger Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Audit Ledger
              </span>
              <span className="text-xs text-slate-400">({pagination.total} records)</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ALL">All Transactions</option>
                <option value="RECHARGE">Recharges Only</option>
                <option value="USAGE_DEDUCTION">Consumption Deductions</option>
                <option value="POSTPAID_DISPATCH">Postpaid / Bypass Dispatches</option>
                <option value="REFUND_DISPATCH_FAILURE">Failure Refunds</option>
                <option value="ADJUSTMENT_CREDIT">Adjustments</option>
              </select>

              <input
                type="text"
                placeholder="Search ref, memo, actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 w-44 sm:w-56"
              />

              <button
                type="button"
                onClick={() => fetchLedger(1)}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                title="Refresh ledger"
              >
                <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* High Density Ledger Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 whitespace-nowrap">Date & Time (IST)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 text-center">Rate</th>
                  <th className="py-2.5 px-3 text-right">Messages</th>
                  <th className="py-2.5 px-3 text-right">Balance After</th>
                  <th className="py-2.5 px-3">Payment / Ref ID</th>
                  <th className="py-2.5 px-3">Processed By</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      Loading wallet ledger...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No wallet transactions recorded yet. Click "Add Money to Wallet" to perform the first recharge.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isCredit = tx.amount > 0;
                    const isDebit = tx.amount < 0;

                    let typeBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                    if (tx.transactionType === 'RECHARGE') {
                      typeBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                    } else if (tx.transactionType === 'USAGE_DEDUCTION') {
                      typeBadgeClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
                    } else if (tx.transactionType === 'POSTPAID_DISPATCH') {
                      typeBadgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                    } else if (tx.transactionType === 'REFUND_DISPATCH_FAILURE') {
                      typeBadgeClass = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20';
                    }

                    return (
                      <tr key={tx._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-sans">
                          {tx.formattedTimestamp || new Date(tx.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${typeBadgeClass}`}>
                            {tx.transactionType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isDebit
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500'
                        }`}>
                          {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-xs">
                          ₹{Number(tx.ratePerMessage || 0.90).toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          tx.messagesCount > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.messagesCount < 0
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400'
                        }`}>
                          {tx.messagesCount > 0 ? `+${tx.messagesCount}` : tx.messagesCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          ₹{Number(tx.balanceAfter || 0).toFixed(2)}{' '}
                          <span className="text-[11px] font-normal text-slate-400">
                            ({tx.messagesAfter} msgs)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {tx.paymentMode || 'System'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[120px]" title={tx.referenceId}>
                            {tx.referenceId || '-'}
                          </div>
                          {tx.taxInvoiceNumber && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              Inv: {tx.taxInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {tx.performedBy?.name || 'Super Admin'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {tx.performedBy?.mobile || tx.performedBy?.role || ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={tx.description}>
                          {tx.description || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
              <span>Showing page {pagination.page} of {pagination.pages}</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLedger(pagination.page - 1)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchLedger(pagination.page + 1)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* --- RECHARGE MODAL DIALOG --- */}
      {showRechargeModal && (
        <Modal
          isOpen={showRechargeModal}
          onClose={() => setShowRechargeModal(false)}
          title="Add Money / Recharge WhatsApp Wallet"
        >
          <form onSubmit={handleRechargeSubmit} className="space-y-4">
            
            {/* Mode Switcher: By Amount vs By Message Target */}
            <div className="flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCalculatorMode('AMOUNT')}
                className={`flex-1 py-1.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                  calculatorMode === 'AMOUNT'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>💰</span> Top-up by Amount (₹)
              </button>
              <button
                type="button"
                onClick={() => setCalculatorMode('MESSAGES')}
                className={`flex-1 py-1.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                  calculatorMode === 'MESSAGES'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>🎯</span> Top-up by Message Target
              </button>
            </div>

            {/* Quick Chips & Inputs */}
            {calculatorMode === 'AMOUNT' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Quick Amount or Enter Custom Amount (₹)
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {['500', '1000', '2000', '5000', '10000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setRechargeAmount(amt);
                        const msgs = Math.floor(Number(amt) / activeCalcRate);
                        setTargetMessages(String(msgs));
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        rechargeAmount === amt
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                      }`}
                    >
                      +₹{Number(amt).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={rechargeAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRechargeAmount(val);
                      const msgs = activeCalcRate > 0 ? Math.floor(parseFloat(val || 0) / activeCalcRate) : 0;
                      setTargetMessages(String(msgs));
                    }}
                    placeholder="e.g. 2000"
                    className="w-full pl-8 pr-3 py-2 text-base font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Target Message Volume or Enter Custom Count
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {['1000', '2500', '5000', '10000', '25000'].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setTargetMessages(count);
                        const requiredAmt = (Number(count) * activeCalcRate).toFixed(2);
                        setRechargeAmount(requiredAmt);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        targetMessages === count
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-500'
                      }`}
                    >
                      {Number(count).toLocaleString('en-IN')} msgs
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">💬</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetMessages}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setTargetMessages(e.target.value);
                      const requiredAmt = (count * activeCalcRate).toFixed(2);
                      setRechargeAmount(requiredAmt);
                    }}
                    placeholder="e.g. 5000"
                    className="w-full pl-8 pr-3 py-2 text-base font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Calculation Banner */}
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  {calculatorMode === 'MESSAGES' ? 'Calculated Top-up Required' : 'Calculated Message Credits'}
                </span>
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                  ₹{rechargePreviewAmount.toLocaleString('en-IN')} @ ₹{activeCalcRate.toFixed(2)}/msg ={' '}
                  <span className="underline decoration-2">{previewMessages.toLocaleString('en-IN')} WhatsApp Messages</span>
                </span>
              </div>
              <span className="text-2xl">{calculatorMode === 'MESSAGES' ? '🎯' : '⚡'}</span>
            </div>

            {/* Payment Mode & Reference ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="RAZORPAY">Razorpay Gateway</option>
                  <option value="SYSTEM_ADJUSTMENT">System / Credit Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  UTR / Reference / Cheque #
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="e.g. UPI-202611030981"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* GST Tax Invoice Toggle */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateInvoice}
                  onChange={(e) => setGenerateInvoice(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Generate Official GST Tax Invoice in Renic Soft Billing
                </span>
              </label>

              {generateInvoice && (
                <div className="pl-6 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gstMode"
                      checked={gstInclusive}
                      onChange={() => setGstInclusive(true)}
                    />
                    <span>18% GST Inclusive (₹{rechargePreviewAmount} total)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gstMode"
                      checked={!gstInclusive}
                      onChange={() => setGstInclusive(false)}
                    />
                    <span>+18% GST Added (₹{(rechargePreviewAmount * 1.18).toFixed(2)} total)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Notes / Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Memo / Notes (Optional)
              </label>
              <input
                type="text"
                value={rechargeNotes}
                onChange={(e) => setRechargeNotes(e.target.value)}
                placeholder="e.g. Diwali festive campaign balance top-up"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            {/* Actor Attribution Footer */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>👤 Processing Actor:</span>
              <strong className="text-slate-700 dark:text-slate-300">
                {user?.name || 'Super Admin'} ({user?.mobile || '9345578103'})
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRechargeModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRecharge}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition disabled:opacity-50"
              >
                {submittingRecharge ? 'Crediting Wallet...' : `Confirm & Add ₹${rechargePreviewAmount.toLocaleString('en-IN')}`}
              </button>
            </div>

          </form>
        </Modal>
      )}

      {/* --- EDIT RATE MODAL DIALOG --- */}
      {showRateModal && (
        <Modal
          isOpen={showRateModal}
          onClose={() => setShowRateModal(false)}
          title="Configure Per-Message Rate (Super Admin Only)"
        >
          <form onSubmit={handleRateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Message Cost in Rupees (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  placeholder="0.90"
                  className="w-full pl-8 pr-3 py-2 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Default: ₹0.90 per message (90 paise). Enter e.g. 0.80 for 80 paise, 1.00 for ₹1.00.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-300">
              💡 Setting rate to ₹{parseFloat(newRateInput) || 0.90} will instantly recalculate client's current balance of ₹{currentBalance.toFixed(2)} into{' '}
              <strong>{parseFloat(newRateInput) > 0 ? Math.floor(currentBalance / parseFloat(newRateInput)).toLocaleString('en-IN') : 0} messages</strong>.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRate}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50"
              >
                {submittingRate ? 'Updating...' : 'Save New Rate'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
