import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { activateSubscription } from '@/lib/activateSubscription';

function setSubCookie(res: NextResponse) {
  res.cookies.set('mr_has_sub', '1', {
    path:     '/',
    maxAge:   216000,
    sameSite: 'lax',
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
  });
}

async function checkGlobalPayin(gpIntentId: string): Promise<{
  paid: boolean;
  gpTxnId: string | null;
  amount: number;
  raw: object;
} | null> {
  try {
    const apiKey = process.env.GLOBALPAYIN_API_KEY!;
    const res = await fetch(`https://app.globalpayin.com/api/payments/intents/${gpIntentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const status  = String(data.data?.status ?? '').toLowerCase();
    const gpTxnId = data.data?.transactionId ?? null;
    const amount  = parseFloat(data.data?.amount ?? '0');

    return {
      paid:    status === 'success' || status === 'completed' || status === 'paid',
      gpTxnId,
      amount,
      raw:     data,
    };
  } catch (err) {
    console.error('GlobalPayin status check error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { txnId } = await req.json();

    if (!txnId) {
      return NextResponse.json({ success: false, message: 'txnId required' }, { status: 400 });
    }

    const payRes = await pool.query(
      `SELECT id, user_id, status, gp_intent_id FROM payments WHERE txn_id = $1`,
      [txnId],
    );

    if (payRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Payment record not found' });
    }

    const pay = payRes.rows[0];

    // ── FAST PATH: webhook already processed it ──────────────────────────────
    if (pay.status === 'success') {
      const response = NextResponse.json({ success: true });
      setSubCookie(response);
      return response;
    }

    // ── FALLBACK: webhook hasn't come yet — ask GlobalPayin directly ─────────
    if (!pay.gp_intent_id) {
      return NextResponse.json({ success: false, message: 'Payment not completed yet' });
    }

    const gpCheck = await checkGlobalPayin(pay.gp_intent_id);

    if (!gpCheck || !gpCheck.paid) {
      return NextResponse.json({ success: false, message: 'Payment not completed yet' });
    }

    // GlobalPayin confirms payment — activate subscription
    const result = await activateSubscription(
      txnId,
      gpCheck.gpTxnId,
      gpCheck.raw,
      gpCheck.amount,
      '',
      '',
      req,
    );

    if (!result) {
      return NextResponse.json({ success: false, message: 'Activation failed' });
    }

    const response = NextResponse.json({ success: true });
    setSubCookie(response);
    return response;
  } catch (err) {
    console.error('payment/verify error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
