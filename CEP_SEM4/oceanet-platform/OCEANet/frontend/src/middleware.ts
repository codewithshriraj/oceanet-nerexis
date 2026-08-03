import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/sign-in', '/privacy', '/terms', '/contact'];
const ADMIN_ONLY_PATHS = ['/api-hub'];
const AUTH_ONLY_REDIRECT_PATHS = ['/sign-in'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAuthOnlyRedirectPath(pathname: string): boolean {
  return AUTH_ONLY_REDIRECT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('nerexis_auth_token')?.value;
  const publicPath = isPublicPath(pathname);

  if (!token && !publicPath) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (token && isAuthOnlyRedirectPath(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (token && isAdminOnlyPath(pathname)) {
    const role = request.cookies.get('nerexis_user_role')?.value;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/).*)'],
};
