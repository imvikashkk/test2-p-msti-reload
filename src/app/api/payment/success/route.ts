import { NextRequest, NextResponse } from 'next/server';

// Kept as a fallback redirect — main processing happens at /api/payment/callback
export async function GET(req: NextRequest) {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL!;
  const { searchParams } = new URL(req.url);
  const txnId   = searchParams.get('txnid') ?? searchParams.get('orderId') ?? '';
  const amount  = searchParams.get('amount') ?? '0';

  if (!txnId) return NextResponse.redirect(`${appUrl}/subscription`, 303);

  return NextResponse.redirect(
    `${appUrl}/?mr_purchase=1&txnid=${encodeURIComponent(txnId)}&amount=${encodeURIComponent(amount)}`,
    303,
  );
}

export async function POST(req: NextRequest) {
  return GET(req);
}
