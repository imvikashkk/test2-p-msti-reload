'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface PaymentData {
  txnId: string;
  paymentUrl: string;
  qrCode: string | null;
  qrString: string | null;
  amount: number;
  expiresAt?: string | null;
}

const UPI_APPS = [
  {
    id: 'gpay',
    label: 'Google Pay',
    logo: '/upi/gpay.png',
    getUrl: (u: string) => u.replace('upi://pay', 'tez://upi/pay'),
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    logo: '/upi/phonepe.png',
    getUrl: (u: string) => u.replace('upi://', 'phonepe://'),
  },
  {
    id: 'paytm',
    label: 'Paytm',
    logo: '/upi/paytm.png',
    getUrl: (u: string) => u.replace('upi://', 'paytmmp://'),
  },
  {
    id: 'bhim',
    label: 'BHIM UPI',
    logo: '/upi/bhim.png',
    getUrl: (u: string) => u,
  },
];

function useCountdown(expiresAt: string | null | undefined) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecs(calc());
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return secs;
}

export default function PaymentModal({
  data,
  onClose,
}: {
  data: PaymentData;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'checking' | 'success'>('pending');
  const overlayRef = useRef<HTMLDivElement>(null);
  const secs       = useCountdown(data.expiresAt);
  const mins       = Math.floor(secs / 60);
  const remSecs    = secs % 60;
  const expired    = secs === 0 && !!data.expiresAt;

  // QR value: prefer UPI qrString, fallback to intentUrl (payment page)
  const qrValue = data.qrString ?? data.paymentUrl;

  // Auto-poll every 5s
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res  = await fetch('/api/payment/verify', {
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
      const res  = await fetch('/api/payment/verify', {
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
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: '#0d0010', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 80px rgba(180,0,0,0.12)' }}
      >
        {/* Close */}
        {status !== 'success' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' ? (
          <div className="p-10 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.5)', boxShadow: '0 0 32px -8px rgba(34,197,94,0.5)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5} className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Payment Successful!</h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Subscription active ho gayi 🎉</p>
          </div>
        ) : (
          <div className="p-6">

            {/* Amount + Timer */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Amount</p>
                <p className="text-2xl font-black text-white">₹{data.amount}</p>
              </div>
              {data.expiresAt && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    border: `1px solid ${expired ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    background: 'rgba(0,0,0,0.3)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: expired ? '#ef4444' : '#c40d0d' }} />
                  <span className="font-mono text-xs" style={{ color: expired ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>
                    {expired ? 'Expired' : `${mins}:${remSecs.toString().padStart(2, '0')}`}
                  </span>
                </div>
              )}
            </div>

            {!expired ? (
              <>
                {/* QR Code */}
                <div className="flex flex-col items-center mb-5">
                  <div
                    className="p-4 rounded-2xl mb-3"
                    style={{ background: '#fff', border: '2px solid rgba(196,13,13,0.3)', boxShadow: '0 0 30px rgba(196,13,13,0.08)' }}
                  >
                    <QRCodeSVG value={qrValue} size={170} bgColor="#ffffff" fgColor="#111111" level="M" />
                  </div>
                  <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Google Pay, PhonePe, ya kisi bhi UPI app se scan karo
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <span className="text-[9px] uppercase tracking-[0.4em]" style={{ color: 'rgba(255,255,255,0.2)' }}>Ya seedha app kholo</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                </div>

                {/* UPI App Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {UPI_APPS.map((app) => (
                    <a
                      key={app.id}
                      href={app.getUrl(qrValue)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-150 active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={app.logo} alt={app.label} className="w-9 h-9 rounded-xl shrink-0 object-cover" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-white">{app.label}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Tap to open</p>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Any other UPI app */}
                <a
                  href={data.paymentUrl}
                  className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl transition-all duration-150 active:scale-95 mb-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/upi/upi-other.jpg" alt="UPI" className="w-9 h-9 rounded-xl shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white">Koi bhi UPI App</p>
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>App chooser khulega</p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </>
            ) : (
              <div className="text-center py-8 mb-4">
                <p className="text-sm mb-2" style={{ color: '#ef4444' }}>Payment link expire ho gaya</p>
                <button
                  onClick={onClose}
                  className="text-xs tracking-widest uppercase px-5 py-2 rounded-full transition-colors"
                  style={{ border: '1px solid rgba(196,13,13,0.4)', color: '#c40d0d' }}
                >
                  Dobara Try Karo
                </button>
              </div>
            )}

            {/* Verify button */}
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={handleVerify}
                disabled={status === 'checking'}
                className="w-full py-3.5 rounded-xl text-xs tracking-widest uppercase font-medium transition-all duration-200 disabled:opacity-50"
                style={{ background: 'rgba(196,13,13,0.08)', border: '1px solid rgba(196,13,13,0.25)', color: '#ff4444' }}
              >
                {status === 'checking' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
                    </svg>
                    Check ho raha hai...
                  </span>
                ) : (
                  '✓  Maine Payment Kar Di'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
