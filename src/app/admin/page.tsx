'use client';

import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#FF2D6B';
const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'success' | 'pending' | 'failed';

interface PaymentRow {
  user_id: number;
  user_number: string;
  user_payment: number;
  payment_status: 'success' | 'pending' | 'failed';
  date_time: string;
  txn_id: string;
}

interface Stats {
  total_payments: string;
  total_successful: string;
  total_pending: string;
  total_failed: string;
  total_users: string;
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: 'rgba(34,197,94,.12)',  color: '#4ade80', label: 'Success' },
  pending: { bg: 'rgba(234,179,8,.12)',  color: '#facc15', label: 'Pending' },
  failed:  { bg: 'rgba(239,68,68,.12)',  color: '#f87171', label: 'Failed'  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? { bg: 'rgba(255,255,255,.08)', color: '#fff', label: status };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}
    >
      {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

const FILTER_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: 'all',     label: 'All',     color: '#94a3b8' },
  { key: 'success', label: 'Success', color: '#4ade80' },
  { key: 'pending', label: 'Pending', color: '#facc15' },
  { key: 'failed',  label: 'Failed',  color: '#f87171' },
];

export default function AdminDashboard() {
  const [rows, setRows]               = useState<PaymentRow[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('success');
  const [fromDate, setFromDate]       = useState(todayStr);
  const [toDate, setToDate]           = useState(todayStr);
  const [allTime, setAllTime]         = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchData = useCallback(async (
    pg: number,
    status: StatusFilter,
    from: string,
    to: string,
    isAllTime: boolean,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        status,
        ...(!isAllTime && from && { from }),
        ...(!isAllTime && to   && { to   }),
      });
      const res = await fetch(`/api/admin/data?${params}`);
      if (res.status === 401) { window.location.href = '/admin_auth'; return; }
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setStats(json.stats);
        setTotal(json.total);
      }
    } catch {
      window.location.href = '/admin_auth';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, statusFilter, fromDate, toDate, allTime);
  }, [page, statusFilter, fromDate, toDate, allTime, fetchData]);

  const handleFilterChange  = (f: StatusFilter) => { setStatusFilter(f); setPage(1); };
  const handleFromChange    = (v: string)        => { setFromDate(v);    setPage(1); };
  const handleToChange      = (v: string)        => { setToDate(v);      setPage(1); };
  const handleAllTimeToggle = ()                 => { setAllTime((p) => !p); setPage(1); };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin_auth';
  };

  const statCards = stats ? [
    { label: 'Total Users',    value: stats.total_users,      color: '#818cf8' },
    { label: 'Total Payments', value: stats.total_payments,   color: '#94a3b8' },
    { label: 'Successful',     value: stats.total_successful, color: '#4ade80' },
    { label: 'Pending',        value: stats.total_pending,    color: '#facc15' },
    { label: 'Failed',         value: stats.total_failed,     color: '#f87171' },
  ] : [];

  return (
    <main
      className="min-h-[100dvh] text-white"
      style={{ background: '#080608', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}
    >
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fu { animation: fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 9999px; }
        tr:hover td { background: rgba(255,255,255,.025) !important; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
        input[type="date"]:focus { outline: none; }
      `}</style>

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5"
        style={{ background: 'rgba(8,6,8,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.07)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg,#be123c,${ACCENT})` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span className="text-[14px] font-black text-white">Masti Reload</span>
            <span className="ml-2 text-[9px] font-black uppercase tracking-[.15em] px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}33` }}>Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => fetchData(page, statusFilter, fromDate, toDate, allTime)} className="p-2 rounded-lg text-white/30 hover:text-white/70 transition-colors" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }} title="Refresh">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
          {!logoutConfirm ? (
            <button onClick={() => setLogoutConfirm(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/35" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>Logout</button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/40">Sure?</span>
              <button onClick={() => setLogoutConfirm(false)} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/40" style={{ background: 'rgba(255,255,255,.05)' }}>No</button>
              <button onClick={handleLogout} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white" style={{ background: 'rgba(220,38,38,.5)' }}>Yes</button>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 fu">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-[14px] px-4 py-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                <p className="text-[9px] font-black uppercase tracking-[.15em] mb-1" style={{ color: 'rgba(255,255,255,.3)' }}>{card.label}</p>
                <p className="text-[20px] font-black" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table card */}
        <div className="rounded-[18px] overflow-hidden fu" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', animationDelay: '.06s' }}>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_TABS.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleFilterChange(tab.key)}
                    className="px-3 py-1.5 rounded-[8px] text-[11px] font-black uppercase tracking-wide transition-all"
                    style={{
                      background: active ? `${tab.color}18` : 'rgba(255,255,255,.04)',
                      border: `1px solid ${active ? tab.color + '55' : 'rgba(255,255,255,.07)'}`,
                      color: active ? tab.color : 'rgba(255,255,255,.3)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 self-center" style={{ background: 'rgba(255,255,255,.08)' }} />

            {/* Date range + All Time */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* All Time toggle */}
              <button
                onClick={handleAllTimeToggle}
                className="px-3 py-1.5 rounded-[8px] text-[11px] font-black uppercase tracking-wide transition-all"
                style={{
                  background: allTime ? 'rgba(129,140,248,.15)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${allTime ? 'rgba(129,140,248,.5)' : 'rgba(255,255,255,.07)'}`,
                  color: allTime ? '#818cf8' : 'rgba(255,255,255,.3)',
                }}
              >
                All Time
              </button>

              {/* From */}
              <div className="relative flex items-center" style={{ opacity: allTime ? 0.3 : 1, transition: 'opacity .2s' }}>
                <svg className="absolute left-2.5 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={2} strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  disabled={allTime}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-[8px] text-[11px] font-semibold text-white/70 transition-all"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.1)',
                    colorScheme: 'dark',
                    cursor: allTime ? 'not-allowed' : 'pointer',
                  }}
                />
              </div>

              <span className="text-[11px] font-semibold" style={{ color: allTime ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.25)', transition: 'color .2s' }}>to</span>

              {/* To */}
              <div className="relative flex items-center" style={{ opacity: allTime ? 0.3 : 1, transition: 'opacity .2s' }}>
                <svg className="absolute left-2.5 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={2} strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  disabled={allTime}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-[8px] text-[11px] font-semibold text-white/70 transition-all"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.1)',
                    colorScheme: 'dark',
                    cursor: allTime ? 'not-allowed' : 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Page info — push to end */}
            <span className="ml-auto text-[11px] text-white/25 hidden sm:block">
              {total} results · Page {page}/{totalPages || 1}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[680px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  {['SN', 'User ID', 'Mobile', 'Amount', 'Status', 'Date & Time'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black uppercase tracking-[.16em]" style={{ color: 'rgba(255,255,255,.25)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                      {[30, 60, 110, 55, 70, 130].map((w, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-4 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,.06)', width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-white/25">No payments found</td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={`${row.user_id}-${row.txn_id}-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background .15s' }}>
                      <td className="px-5 py-3.5"><span className="text-[12px] font-bold text-white/30">{(page - 1) * PAGE_SIZE + i + 1}</span></td>
                      <td className="px-5 py-3.5"><span className="text-[12px] font-bold text-white/50">#{row.user_id}</span></td>
                      <td className="px-5 py-3.5"><span className="text-[13px] font-semibold text-white">+91 {row.user_number}</span></td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-black" style={{ color: STATUS_CFG[row.payment_status]?.color ?? 'rgba(255,255,255,.6)' }}>
                          ₹{Number(row.user_payment).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={row.payment_status} /></td>
                      <td className="px-5 py-3.5"><span className="text-[11px] text-white/35">{formatDate(row.date_time)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-bold transition-opacity disabled:opacity-25"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                Prev
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 7)            pg = i + 1;
                  else if (page <= 4)             pg = i + 1;
                  else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                  else                            pg = page - 3 + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className="w-8 h-8 rounded-[8px] text-[12px] font-bold transition-all"
                      style={{
                        background: pg === page ? `linear-gradient(135deg,#be123c,${ACCENT})` : 'rgba(255,255,255,.04)',
                        border: pg === page ? 'none' : '1px solid rgba(255,255,255,.07)',
                        color: pg === page ? 'white' : 'rgba(255,255,255,.35)',
                        boxShadow: pg === page ? `0 4px 12px -2px ${ACCENT}55` : 'none',
                      }}
                    >{pg}</button>
                  );
                })}
              </div>

              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-bold transition-opacity disabled:opacity-25"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)' }}
              >
                Next
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
