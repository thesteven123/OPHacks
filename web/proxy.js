import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Sends signed-out visitors of /mod to the login page. The moderator API routes check the session again on their own.
export async function proxy(request) {
  if (await getToken({ req: request })) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/mod/:path*'] };
