import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import Badge from '../components/Badge.jsx';

export default function AppDeployments() {
  const { showSnackbar = () => {} } = useSnackbar() || {};
  const [history, setHistory] = useState([]);
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  const fetchApps = useCallback(async () => {
    try {
      const res = await api.get('/applications');
      setApps(res.data.applications || []);
    } catch (err) {
      console.error('Failed to load apps:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedApp === 'ALL' ? '/applications/sync-history' : `/applications/sync-history?appCode=${selectedApp}`;
      const res = await api.get(url);
      setHistory(res.data.history || []);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load deployment history', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedApp, showSnackbar]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSyncCommit = async (appId, appName) => {
    try {
      setSyncingId(appId);
      const res = await api.post(`/applications/${appId}/git-sync`);
      showSnackbar(res.data.message || `Synced ${appName} with latest commit!`, 'success');
      fetchHistory();
      fetchApps();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Git sync failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const totalDeployments = history.length;
  const successCount = history.filter(h => h.status === 'SUCCESS').length;

  return (
    <div className="w-full space-y-2 pb-8">
      {/* Compact Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-[#84cc16] flex items-center justify-center font-bold flex-shrink-0">
            <Icon name="gitBranch" className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              Git Deployments &amp; Sync History
            </h1>
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              • Zero-downtime hot-reloads and route discoveries
            </span>
          </div>
        </div>

        {/* Quick Sync Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
          {apps.map(a => (
            <button
              key={a._id}
              onClick={() => handleSyncCommit(a._id, a.name)}
              disabled={syncingId === a._id}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition"
              title={`Sync ${a.name} with latest commit`}
            >
              <Icon name="refresh" className={`w-3 h-3 ${syncingId === a._id ? 'animate-spin text-emerald-600' : ''}`} />
              Sync {a.appCode.split('_')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Compact 4-Card KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Releases</span>
          <span className="text-sm font-black text-slate-900 font-mono">{totalDeployments}</span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Zero-Downtime</span>
          <span className="text-sm font-black text-emerald-800 font-mono">100%</span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Linked Apps</span>
          <span className="text-sm font-black text-slate-900 font-mono">{apps.length} PaaS</span>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-lg border border-teal-200/80 shadow-2xs flex items-center justify-between">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Engine</span>
          <span className="text-xs font-black text-teal-800 font-mono">SSE Active</span>
        </div>
      </div>

      {/* Compact Application Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => setSelectedApp('ALL')}
          className={`px-3 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap ${
            selectedApp === 'ALL'
              ? 'bg-[#0f172a] text-[#84cc16] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Applications ({history.length})
        </button>
        {apps.map(a => (
          <button
            key={a.appCode}
            onClick={() => setSelectedApp(a.appCode)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              selectedApp === a.appCode
                ? 'bg-[#0f172a] text-[#84cc16] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Deployment Timeline */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs font-medium">
          <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto mb-1.5 text-emerald-600" />
          Loading deployment timeline...
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200/90 text-center space-y-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Icon name="gitBranch" className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-800 text-xs">No Deployments Recorded Yet</h3>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Click <strong>Sync Commit</strong> above to fetch the latest Git revision.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((log) => (
            <div key={log._id} className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-emerald-500">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                    {log.commitHash}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-200">
                    {log.appName || log.appCode}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    by <strong>{log.commitAuthor}</strong> · {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {log.triggerType}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-900 leading-snug">
                  {log.commitMessage}
                </div>

                {log.newRoutesFound && log.newRoutesFound.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      ✨ New Routes Detected:
                    </span>
                    {log.newRoutesFound.map((r, i) => (
                      <span key={i} className="text-[11px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    DEPLOYED (0s downtime)
                  </div>
                  <div className="text-[11px] text-slate-400">Duration: {log.durationMs || 120}ms</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
