import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('mr_admin')?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const url          = new URL(req.url);
  const page         = Math.max(1, parseInt(url.searchParams.get('page')   || '1'));
  const statusFilter = url.searchParams.get('status') || 'all';
  const from         = url.searchParams.get('from')   || '';
  const to           = url.searchParams.get('to')     || '';
  const limit        = 20;
  const offset       = (page - 1) * limit;

  const validStatuses = ['success', 'pending', 'failed'];

  // Build params and conditions separately for each query
  // date conditions use (created_at AT TIME ZONE 'Asia/Kolkata')::date for IST comparison

  const dateParams: string[] = [];
  if (from) dateParams.push(from);
  if (to)   dateParams.push(to);

  // ── data query (JOIN — must use p.created_at) ──
  const dataConditions: string[] = [];
  const dataParams: (string | number)[] = [];

  if (from) {
    dataParams.push(from);
    dataConditions.push(`(p.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${dataParams.length}::date`);
  }
  if (to) {
    dataParams.push(to);
    dataConditions.push(`(p.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${dataParams.length}::date`);
  }
  if (validStatuses.includes(statusFilter)) {
    dataParams.push(statusFilter);
    dataConditions.push(`p.status = $${dataParams.length}`);
  }
  const dataWhere = dataConditions.length ? `WHERE ${dataConditions.join(' AND ')}` : '';

  // ── count query (payments table, no join) ──
  const countConditions: string[] = [];
  const countParams: (string | number)[] = [];

  if (from) {
    countParams.push(from);
    countConditions.push(`(created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${countParams.length}::date`);
  }
  if (to) {
    countParams.push(to);
    countConditions.push(`(created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${countParams.length}::date`);
  }
  if (validStatuses.includes(statusFilter)) {
    countParams.push(statusFilter);
    countConditions.push(`status = $${countParams.length}`);
  }
  const countWhere = countConditions.length ? `WHERE ${countConditions.join(' AND ')}` : '';

  // ── stats query (date-filtered only, no status filter) ──
  const statsConditions: string[] = [];
  const statsParams: (string | number)[] = [];

  if (from) {
    statsParams.push(from);
    statsConditions.push(`(created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${statsParams.length}::date`);
  }
  if (to) {
    statsParams.push(to);
    statsConditions.push(`(created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${statsParams.length}::date`);
  }
  const statsWhere = statsConditions.length ? `WHERE ${statsConditions.join(' AND ')}` : '';

  try {
    const [dataRes, countRes, statsRes] = await Promise.all([
      pool.query(
        `SELECT
           u.id         AS user_id,
           u.mobile     AS user_number,
           p.amount     AS user_payment,
           p.status     AS payment_status,
           p.created_at AS date_time,
           p.txn_id
         FROM payments p
         JOIN users u ON u.id = p.user_id
         ${dataWhere}
         ORDER BY p.created_at DESC
         LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`,
        [...dataParams, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM payments ${countWhere}`,
        countParams,
      ),
      pool.query(
        `SELECT
           COUNT(*)                                          AS total_payments,
           COUNT(*) FILTER (WHERE status = 'success')       AS total_successful,
           COUNT(*) FILTER (WHERE status = 'pending')       AS total_pending,
           COUNT(*) FILTER (WHERE status = 'failed')        AS total_failed,
           COUNT(DISTINCT user_id)                          AS total_users
         FROM payments
         ${statsWhere}`,
        statsParams,
      ),
    ]);

    return NextResponse.json({
      success: true,
      data:  dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      stats: statsRes.rows[0],
      page,
      limit,
    });
  } catch (err) {
    console.error('admin data error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
