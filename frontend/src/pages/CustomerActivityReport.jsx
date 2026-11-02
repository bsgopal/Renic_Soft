import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function CustomerActivityReport() {
  const { showSnackbar = () => {} } = useSnackbar() || {};
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({ totalLogs: 0, totalScreenTimeMinutes: 0, topScreens: [], topCustomers: [] });
  const [screensList, setScreensList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  const [selectedScreen, setSelectedScreen] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await api.get('/v1/activity/screens-list');
      setScreensList(res.data.screens || []);
      setCustomersList(res.data.customers || []);
    } catch {
      // silent
    }
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        customerCode: selectedCustomer,
        screenName: selectedScreen,
        actionType: selectedAction,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      const res = await api.get('/v1/activity/summary', { params });
      setLogs(res.data.logs || []);
      setMetrics(res.data.metrics || { totalLogs: 0, totalScreenTimeMinutes: 0, topScreens: [], topCustomers: [] });
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to fetch activity reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, selectedCustomer, selectedScreen, selectedAction, startDate, endDate, showSnackbar]);

  useEffect(() => {
    fetchDropdowns();
  }, [fetchDropdowns]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        customerCode: selectedCustomer,
        screenName: selectedScreen,
        actionType: selectedAction,
        startDate: startDate || '',
        endDate: endDate || ''
      });

      const url = `${api.defaults.baseURL || ''}/v1/activity/export?${params.toString()}`;
      window.open(url, '_blank');
      showSnackbar('Activity audit report exported to CSV successfully!', 'success');
    } catch (err) {
      showSnackbar('Export failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedCustomer('ALL');
    setSelectedScreen('ALL');
    setSelectedAction('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="w-full space-y-2 pb-8">
      {/* Compact Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-[#84cc16] flex items-center justify-center font-bold flex-shrink-0">
            <Icon name="eye" className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              Customer Screen Activity &amp; Audit Log
            </h1>
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              • Real-time audit of tenant navigation, screen engagement &amp; actions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
          >
            <Icon name="refresh" className="w-3 h-3" /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50"
          >
            <Icon name="print" className="w-3 h-3" /> {exporting ? 'Exporting...' : 'Export Excel / CSV'}
          </button>
        </div>
      </div>

      {/* Compact 4-Card KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screen Views</span>
          <span className="text-sm font-black text-slate-900 font-mono">{metrics.totalLogs?.toLocaleString()}</span>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Engagement</span>
          <span className="text-sm font-black text-emerald-900 font-mono">{metrics.totalScreenTimeMinutes?.toLocaleString()} min</span>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-lg border border-purple-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Top Screen</span>
          <span className="text-xs font-bold text-purple-900 truncate max-w-[120px] font-mono">{metrics.topScreens[0]?.screen || 'N/A'}</span>
        </div>

        <div className="bg-white px-3 py-1.5 rounded-lg border border-amber-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Active Tenants</span>
          <span className="text-sm font-black text-amber-900 font-mono">{customersList.length}</span>
        </div>
      </div>

      {/* Compact Filter Toolbar */}
      <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
        {/* Customer Filter */}
        <select
          value={selectedCustomer}
          onChange={(e) => { setSelectedCustomer(e.target.value); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-slate-700 font-bold focus:outline-hidden focus:border-[#84cc16] max-w-[150px] truncate"
        >
          <option value="ALL">All Customers</option>
          {customersList.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Screen Filter */}
        <select
          value={selectedScreen}
          onChange={(e) => { setSelectedScreen(e.target.value); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-slate-700 font-bold focus:outline-hidden focus:border-[#84cc16] max-w-[160px] truncate"
        >
          <option value="ALL">All Screens</option>
          {screensList.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Action Type */}
        <select
          value={selectedAction}
          onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-slate-700 font-bold focus:outline-hidden focus:border-[#84cc16]"
        >
          <option value="ALL">All Actions</option>
          <option value="VIEW">VIEW</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="EXPORT">EXPORT</option>
          <option value="LOGIN">LOGIN</option>
        </select>

        {/* Date Filters */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 bg-slate-50 focus:outline-hidden"
          title="From Date"
        />
        <span className="text-slate-400 text-xs">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-0.5 text-slate-700 bg-slate-50 focus:outline-hidden"
          title="To Date"
        />

        {(selectedCustomer !== 'ALL' || selectedScreen !== 'ALL' || selectedAction !== 'ALL' || startDate || endDate) && (
          <button
            onClick={handleResetFilters}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 underline px-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Screen Analytics Breakdown */}
      {metrics.topScreens && metrics.topScreens.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm text-ink">Screen Engagement Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.topScreens.slice(0, 4).map((s) => (
              <div key={s.screen} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-ink truncate max-w-[160px]">{s.screen}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded font-bold">
                    {s.visits} views
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Duration: {s.durationMinutes}m</span>
                  <span>{s.customerCount} customer{s.customerCount > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-ink">Detailed Audit Trail</h3>
          <span className="text-xs text-gray-400">Showing page {page} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/80 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Screen Name</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Time Spent</th>
                <th className="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-400">Loading activity logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-400">No screen activity recorded for selected criteria.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap font-mono text-[11px] text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {log.customerCode}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-ink">
                      {log.screenName}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        log.actionType === 'VIEW' ? 'bg-sky-50 text-sky-700' :
                        log.actionType === 'CREATE' ? 'bg-emerald-50 text-emerald-700' :
                        log.actionType === 'UPDATE' ? 'bg-amber-50 text-amber-700' :
                        log.actionType === 'DELETE' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-gray-700">
                      {log.userName}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-mono text-gray-500">
                      {log.durationSeconds > 0 ? `${log.durationSeconds}s` : '—'}
                    </td>
                    <td className="px-6 py-3.5 max-w-[220px] truncate text-gray-500" title={log.actionDescription}>
                      {log.actionDescription}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
