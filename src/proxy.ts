import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/auth', '/api', '/payment'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get('mr_token')?.value;
  const hasSub = req.cookies.get('mr_has_sub')?.value;
  const adminToken = req.cookies.get('mr_admin')?.value;

  // Admin routes
  if (pathname.startsWith('/admin')) {
    // /admin_auth — if already logged in as admin, go to dashboard
    if (pathname.startsWith('/admin_auth')) {
      if (adminToken) return NextResponse.redirect(new URL('/admin', req.url));
      return NextResponse.next();
    }
    // /admin — require admin cookie
    if (!adminToken) return NextResponse.redirect(new URL('/admin_auth', req.url));
    return NextResponse.next();
  }

  // Logged in users should not access auth pages
  if (token && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Public routes — allow
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Not logged in → auth
  if (!token) {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  // Logged in but no subscription → subscription page
  if (
    hasSub !== '1' &&
    pathname !== '/subscription' &&
    !pathname.startsWith('/profile')
  ) {
    return NextResponse.redirect(new URL('/subscription', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|upi).*)'],
};
