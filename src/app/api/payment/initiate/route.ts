import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId, planId, fbp = '', fbc = '' } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json({ success: false, message: 'userId and planId required' }, { status: 400 });
    }

    const [planRes, userRes] = await Promise.all([
      pool.query(`SELECT id, name, price FROM plans WHERE id = $1 AND is_active = true`, [planId]),
      pool.query(`SELECT id, mobile FROM users WHERE id = $1`, [userId]),
    ]);

    if (planRes.rows.length === 0) return NextResponse.json({ success: false, message: 'Plan not found' }, { status: 404 });
    if (userRes.rows.length === 0) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    const plan = planRes.rows[0];
    const user = userRes.rows[0];

    const txnId  = `MR${Date.now()}${userId}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const apiKey = process.env.GLOBALPAYIN_API_KEY!;

    const gpRes = await fetch('https://app.globalpayin.com/api/payments/intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: plan.price,
        currency: 'INR',
        description: plan.name,
        customerEmail: `${user.mobile}@mastireload.com`,
        customerPhone: user.mobile,
        customerName: `User${userId}`,
        paymentMethod: 'upi',
        callbackUrl: `${appUrl}/api/payment/callback`,
        metadata: {
          orderId: txnId,
          userId: String(userId),
          planId: String(planId),
          fbp,
          fbc,
        },
      }),
    });

    const gpData = await gpRes.json();
    console.log('GlobalPayin response:', gpData);

    const intentUrl  = gpData.intentUrl ?? gpData.data?.intentUrl ?? gpData.data?.providerPaymentUrl;
    const qrString   = gpData.data?.qrString ?? null;
    // Store the human-readable transactionId — used for GET /payments/intents/:transactionId status check
    const gpIntentId = gpData.data?.transactionId ?? gpData.transactionId ?? null;

    if (!intentUrl) {
      return NextResponse.json(
        { success: false, message: gpData.message ?? gpData.error ?? 'Payment init failed' },
        { status: 400 },
      );
    }

    // Generate QR only from UPI string — intentUrl is a web page, not a UPI QR
    const qrCode = gpData.data?.qrCode ??
      (qrString
        ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrString)}&size=300x300&margin=10`
        : null);

    await pool.query(
      `INSERT INTO payments (user_id, plan_id, txn_id, amount, status, gp_intent_id) VALUES ($1,$2,$3,$4,'pending',$5)`,
      [userId, planId, txnId, plan.price, gpIntentId],
    );

    return NextResponse.json({
      success: true,
      data: {
        txnId,
        paymentUrl: intentUrl,
        qrCode,
        qrString:  qrString ?? null,
        amount:    plan.price,
        expiresAt: gpData.data?.expiresAt ?? null,
      },
    });
  } catch (err) {
    console.error('payment/initiate error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
