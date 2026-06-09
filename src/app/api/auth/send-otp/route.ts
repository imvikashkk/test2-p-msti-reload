import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { mobile } = await req.json();

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ success: false, message: 'Invalid mobile number' }, { status: 400 });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Invalidate old OTPs for this mobile
    await pool.query(
      `UPDATE otps SET is_used = true WHERE mobile = $1 AND is_used = false`,
      [mobile]
    );

    // Store new OTP
    await pool.query(
      `INSERT INTO otps (mobile, otp, expires_at) VALUES ($1, $2, $3)`,
      [mobile, otp, expiresAt]
    );

    // Send OTP via authkey.io
    const smsUrl = `https://api.authkey.io/request?authkey=${process.env.OTP_AUTHKEY}&mobile=${mobile}&country_code=91&sid=${process.env.OTP_SID}&otp=${otp}`;
    const smsRes = await fetch(smsUrl);
    const smsData = await smsRes.json().catch(() => ({}));

    if (!smsRes.ok) {
      console.error('OTP send failed:', smsData);
      return NextResponse.json({ success: false, message: 'Failed to send OTP' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('send-otp error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
