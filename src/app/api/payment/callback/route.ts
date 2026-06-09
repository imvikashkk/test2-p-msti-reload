import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import pool from '@/lib/db';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendMetaPurchaseEvent({
  eventId, value, ip, userAgent, phone, sourceUrl, fbp, fbc,
}: {
  eventId: string; value: number; ip: string; userAgent: string;
  phone: string; sourceUrl: string; fbp: string; fbc: string;
}) {
  try {
    const pixelId     = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!pixelId || !accessToken) return;

    await fetch(`https://graph.facebook.com/v23.0/${pixelId}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: sourceUrl,
          user_data: {
            client_ip_address: ip,
            client_user_agent: userAgent,
            ph: sha256(normalizePhone(phone)),
            ...(fbp && { fbp }),
            ...(fbc && { fbc }),
          },
          custom_data: { currency: 'INR', value },
        }],
      }),
    });
  } catch (err) {
    console.error('Meta CAPI error:', err);
  }
}

function setCookies(res: NextResponse, token: string, maxAge: number) {
  const opts = { path: '/', maxAge, sameSite: 'lax' as const, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
  res.cookies.set('mr_has_sub', '1', opts);
  res.cookies.set('mr_token', token, opts);
}

async function activateSubscription(
  txnId: string,
  gpTxnId: string | null,
  rawData: object,
  amount: number,
  fbp: string,
  fbc: string,
  req: NextRequest,
): Promise<{ freshToken: string; newEndDate: Date; alreadyProcessed?: boolean } | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Look up payment record from DB
  const payRes = await pool.query(
    `SELECT id, user_id, plan_id, status FROM payments WHERE txn_id = $1`,
    [txnId],
  );
  if (payRes.rows.length === 0) return null;
  const pay = payRes.rows[0];

  const userRes = await pool.query(`SELECT id, mobile FROM users WHERE id = $1`, [pay.user_id]);
  const user = userRes.rows[0];
  const freshToken = user
    ? Buffer.from(`${user.id}:${user.mobile}:${Date.now()}`).toString('base64')
    : '';

  if (pay.status === 'success') {
    return { freshToken, newEndDate: new Date(), alreadyProcessed: true };
  }

  const planRes = await pool.query(`SELECT duration_days FROM plans WHERE id = $1`, [pay.plan_id]);
  if (planRes.rows.length === 0) return null;
  const { duration_days } = planRes.rows[0];

  const client = await pool.connect();
  let newEndDate: Date;
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE payments SET status='success', easebuzz_txn_id=$1, easebuzz_response=$2, updated_at=NOW()
       WHERE txn_id=$3 AND status='pending'
       RETURNING id`,
      [gpTxnId, JSON.stringify(rawData), txnId],
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return { freshToken, newEndDate: new Date(), alreadyProcessed: true };
    }

    const paymentId = updateRes.rows[0].id;

    const existingRes = await client.query(
      `SELECT end_date FROM subscriptions
       WHERE user_id=$1 AND status='active' AND end_date > NOW()
       ORDER BY end_date DESC LIMIT 1`,
      [pay.user_id],
    );

    const baseDate = existingRes.rows.length > 0
      ? new Date(existingRes.rows[0].end_date)
      : new Date();

    newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + duration_days);

    await client.query(
      `UPDATE subscriptions SET status='cancelled' WHERE user_id=$1 AND status='active'`,
      [pay.user_id],
    );
    await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, end_date, status, payment_id) VALUES ($1,$2,$3,'active',$4)`,
      [pay.user_id, pay.plan_id, newEndDate, paymentId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
  client.release();

  await sendMetaPurchaseEvent({
    eventId: txnId,
    value: amount,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1',
    userAgent: req.headers.get('user-agent') || 'Unknown',
    phone: user?.mobile ?? '',
    sourceUrl: `${appUrl}/subscription`,
    fbp,
    fbc,
  });

  return { freshToken, newEndDate };
}

// Server-side webhook from GlobalPayin
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('GlobalPayin webhook:', JSON.stringify(data));

    const txnId   = data.orderId ?? data.metadata?.orderId ?? data.merchantOrderId ?? data.data?.metadata?.orderId ?? '';
    const gpTxnId = data.transactionId ?? data.paymentIntentId ?? data.data?.transactionId ?? data.paymentId ?? null;
    const status  = String(data.status ?? '').toLowerCase();
    const fbp     = data.metadata?.fbp ?? '';
    const fbc     = data.metadata?.fbc ?? '';
    const amount  = parseFloat(data.amount ?? '0');

    if (!txnId || status !== 'success') {
      if (txnId) {
        await pool.query(
          `UPDATE payments SET status='failed', easebuzz_txn_id=$1, easebuzz_response=$2, updated_at=NOW()
           WHERE txn_id=$3 AND status='pending'`,
          [gpTxnId ?? null, JSON.stringify(data), txnId],
        );
      }
      return NextResponse.json({ success: false });
    }

    const result = await activateSubscription(txnId, gpTxnId, data, amount, fbp, fbc, req);
    if (!result) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('payment/callback POST error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// User redirect from GlobalPayin after payment
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const { searchParams } = new URL(req.url);

  const txnId  = searchParams.get('orderId') ?? searchParams.get('txnid') ?? searchParams.get('merchantOrderId') ?? '';
  const status = String(searchParams.get('status') ?? '').toLowerCase();
  const gpTxnId = searchParams.get('transactionId') ?? searchParams.get('paymentId') ?? null;

  if (!txnId || status !== 'success') {
    return NextResponse.redirect(`${appUrl}/subscription`, 303);
  }

  try {
    const result = await activateSubscription(txnId, gpTxnId, Object.fromEntries(searchParams), 0, '', '', req);

    if (!result) {
      return NextResponse.redirect(`${appUrl}/subscription`, 303);
    }

    const successUrl = `${appUrl}/?mr_purchase=1&txnid=${encodeURIComponent(txnId)}&amount=${encodeURIComponent(searchParams.get('amount') ?? '0')}`;
    const res = NextResponse.redirect(successUrl, 303);
    const secsLeft = Math.ceil((result.newEndDate.getTime() - Date.now()) / 1000);
    setCookies(res, result.freshToken, secsLeft > 0 ? secsLeft : 216000);
    return res;
  } catch (err) {
    console.error('payment/callback GET error:', err);
    return NextResponse.redirect(`${appUrl}/subscription`, 303);
  }
}
