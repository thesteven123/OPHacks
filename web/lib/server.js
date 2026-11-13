import 'server-only';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SESSION_HOURS = 8;

const internalFetch = (path, init = {}) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.INTERNAL_API_KEY || '', ...init.headers },
  });

export const authOptions = {
  session: { strategy: 'jwt', maxAge: SESSION_HOURS * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Moderator',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        const res = await internalFetch('/api/auth/verify', { method: 'POST', body: JSON.stringify({ email: credentials?.email, password: credentials?.password }) });
        return res.ok ? res.json() : null;
      },
    }),
  ],
};

// Forwards a moderator request to the Express API with the internal key, only for a signed-in moderator.
export async function moderatorProxy(path, init) {
  if (!(await getServerSession(authOptions))) return Response.json({ error: 'moderator login required' }, { status: 401 });
  const res = await internalFetch(path, init);
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
}

export const publicFetch = (path) => fetch(`${API_URL}${path}`, { cache: 'no-store' });
