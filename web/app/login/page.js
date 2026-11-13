'use client';
import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const callbackUrl = useSearchParams().get('callbackUrl') || '/mod';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirect: false });
    setBusy(false);
    const isLocalPath = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//');
    if (res?.ok) router.push(isLocalPath ? callbackUrl : '/mod');
    else setError('Wrong email or password, or too many attempts. Try again later.');
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      <button disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="status" role="status">{error}</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main>
      <h1>Moderator login</h1>
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
