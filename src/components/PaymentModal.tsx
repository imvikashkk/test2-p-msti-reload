'use client';

import { useEffect, useState } from 'react';

export interface PaymentData {
  txnId: string;
  paymentUrl: string;
  qrCode: string;
  qrString: string;
  amount: number;
}

const UPI_APPS = [
  {
    name: 'PhonePe',
    icon: (
      <svg viewBox="0 0 48 48" width="28" height="28">
        <rect width="48" height="48" rx="12" fill="#5f259f"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fontSize="22" fill="white">P</text>
      </svg>
    ),
    getUrl: (q: string) => q.replace('upi://', 'phonepe://'),
  },
  {
    name: 'GPay',
    icon: (
      <svg viewBox="0 0 48 48" width="28" height="28">
        <rect width="48" height="48" rx="12" fill="#fff"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fontSize="18" fill="#1a73e8" fontWeight="bold">G</text>
      </svg>
    ),
    getUrl: (q: string) => q.replace('upi://', 'tez://upi/'),
  },
  {
    name: 'Paytm',
    icon: (
      <svg viewBox="0 0 48 48" width="28" height="28">
        <rect width="48" height="48" rx="12" fill="#00baf2"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">PTM</text>
      </svg>
    ),
    getUrl: (q: string) => q.replace('upi://', 'paytmmp://'),
  },
  {
    name: 'BHIM',
    icon: (
      <svg viewBox="0 0 48 48" width="28" height="28">
        <rect width="48" height="48" rx="12" fill="#f37a20"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">BHIM</text>
      </svg>
    ),
    getUrl: (q: string) => q.replace('upi://', 'bhim://'),
  },
];

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PaymentModal({
  data,
  onClose,
}: {
  data: PaymentData;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'checking' | 'success'>('pending');
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-poll every 5 s
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txnId: data.txnId }),
        });
        const json = await res.json();
        if (json.success) {
          setStatus('success');
          setTimeout(() => { window.location.href = '/'; }, 1800);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [data.txnId]);

  async function handleVerify() {
    setStatus('checking');
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txnId: data.txnId }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus('success');
        setTimeout(() => { window.location.href = '/'; }, 1800);
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('pending');
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#0c0010', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="text-[9px] font-black tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Amount to Pay
            </p>
            <p className="text-white text-2xl font-black leading-tight">₹{data.amount}</p>
          </div>

          {status === 'success' ? (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.5)', boxShadow: '0 0 32px -8px rgba(34,197,94,0.5)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <p className="text-white font-black text-lg">Payment Successful!</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Subscription active ho gayi 🎉</p>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div className="flex flex-col items-center px-5 pt-5 pb-3 gap-3">
              <div className="rounded-xl overflow-hidden p-2.5 bg-white shadow-lg">
                <img
                  src={data.qrCode}
                  alt="UPI QR Code"
                  width={176}
                  height={176}
                  className="block"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Kisi bhi UPI app se scan karo
              </p>
              <span
                className="text-[11px] font-mono font-bold px-3 py-1 rounded-full"
                style={{
                  color: timeLeft < 120 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                  background: timeLeft < 120 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${timeLeft < 120 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {timeLeft > 0 ? `⏱ ${formatTime(timeLeft)} baaki` : 'Expired'}
              </span>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 px-5 py-2">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>ya seedha app se karo</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* UPI App buttons */}
            <div className="grid grid-cols-4 gap-2 px-5 pb-4">
              {UPI_APPS.map((app) => (
                <a
                  key={app.name}
                  href={app.getUrl(data.qrString)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {app.icon}
                  <span className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {app.name}
                  </span>
                </a>
              ))}
            </div>

            {/* Pay with any UPI app */}
            <div className="px-5 pb-2">
              <a
                href={data.qrString}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[13px] font-black text-white mb-2"
                style={{
                  background: 'linear-gradient(90deg,#1a1a2e,#16213e)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  boxShadow: '0 4px 16px -4px rgba(99,102,241,0.3)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="10" fill="#white"/>
                  <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fill="white" fontWeight="bold" fontFamily="sans-serif">UPI</text>
                </svg>
                Pay with Any UPI App
              </a>
            </div>

            {/* Open payment page */}
            <div className="px-5 pb-2">
              <a
                href={data.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[12px] font-semibold transition-colors"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                Payment Page Kholo
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            {/* Verify button */}
            <div className="px-5 pb-5 pt-1">
              <button
                onClick={handleVerify}
                disabled={status === 'checking' || timeLeft === 0}
                className="ctabtn w-full py-3.5 rounded-xl text-[13px] font-black text-white tracking-wide disabled:opacity-50"
                style={{ boxShadow: '0 8px 24px -6px rgba(155,8,8,0.55)', letterSpacing: '.04em' }}
              >
                {status === 'checking' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
                    </svg>
                    Check ho raha hai...
                  </span>
                ) : (
                  '✓ Maine Pay Kar Diya — Verify Karo'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
