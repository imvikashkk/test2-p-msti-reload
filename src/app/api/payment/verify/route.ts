import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { txnId } = await req.json();

    if (!txnId) {
      return NextResponse.json({ success: false, message: 'txnId required' }, { status: 400 });
    }

    const payRes = await pool.query(
      `SELECT id, user_id, plan_id, status FROM payments WHERE txn_id = $1`,
      [txnId],
    );

    if (payRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Payment record not found' });
    }

    const pay = payRes.rows[0];

    if (pay.status !== 'success') {
      return NextResponse.json({ success: false, message: 'Payment not completed yet' });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('mr_has_sub', '1', {
      path: '/',
      maxAge: 216000,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (err) {
    console.error('payment/verify error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
