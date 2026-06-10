import { createHash } from 'crypto';
import pool from './db';
import type { NextRequest } from 'next/server';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export async function sendMetaPurchaseEvent({
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
          event_name:        'Purchase',
          event_time:        Math.floor(Date.now() / 1000),
          event_id:          eventId,
          action_source:     'website',
          event_source_url:  sourceUrl,
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

export async function activateSubscription(
  txnId: string,
  gpTxnId: string | null,
  rawData: object,
  amount: number,
  fbp: string,
  fbc: string,
  req: NextRequest,
): Promise<{ freshToken: string; newEndDate: Date; alreadyProcessed?: boolean } | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const payRes = await pool.query(
    `SELECT id, user_id, plan_id, status FROM payments WHERE txn_id = $1`,
    [txnId],
  );
  if (payRes.rows.length === 0) return null;
  const pay = payRes.rows[0];

  const userRes = await pool.query(`SELECT id, mobile FROM users WHERE id = $1`, [pay.user_id]);
  const user    = userRes.rows[0];
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
    eventId:    txnId,
    value:      amount,
    ip:         req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1',
    userAgent:  req.headers.get('user-agent') || 'Unknown',
    phone:      user?.mobile ?? '',
    sourceUrl:  `${appUrl}/subscription`,
    fbp,
    fbc,
  });

  return { freshToken, newEndDate };
}
