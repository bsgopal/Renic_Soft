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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customer Screen Activity & Usage Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Centralized audit log tracking customer navigation, screen engagement, and workflow actions across tenant portals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <Icon name="refresh" className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Icon name="print" className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Excel / CSV'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon name="eye" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{metrics.totalLogs?.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium">Total Screen Views</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Icon name="clock" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{metrics.totalScreenTimeMinutes?.toLocaleString()} min</div>
            <div className="text-xs text-gray-500 font-medium">Customer Engagement Time</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Icon name="dashboard" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-ink truncate max-w-[160px]">
              {metrics.topScreens[0]?.screen || 'N/A'}
            </div>
            <div className="text-xs text-gray-500 font-medium">Most Used Screen</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Icon name="users" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{customersList.length}</div>
            <div className="text-xs text-gray-500 font-medium">Active Logged Tenants</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
        {/* Customer Filter */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Customer Code
          </label>
          <select
            value={selectedCustomer}
            onChange={(e) => { setSelectedCustomer(e.target.value); setPage(1); }}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="ALL">All Customers</option>
            {customersList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Screen Filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Screen Name
          </label>
          <select
            value={selectedScreen}
            onChange={(e) => { setSelectedScreen(e.target.value); setPage(1); }}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="ALL">All Screens</option>
            {screensList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Action Type */}
        <div className="w-36">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Action Type
          </label>
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="ALL">All Actions</option>
            <option value="VIEW">VIEW</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="EXPORT">EXPORT</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="w-36">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            From Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none"
          />
        </div>

        {/* End Date */}
        <div className="w-36">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            To Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none"
          />
        </div>

        {/* Reset */}
        <div className="self-end pb-0.5">
          <button
            onClick={handleResetFilters}
            className="text-xs text-gray-500 hover:text-gray-800 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
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
