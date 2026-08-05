'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError('Incorrect email or password.');
      return;
    }

    router.push('/admin/dashboard');
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password?"');
      return;
    }
    setError('');
    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://hungry-buds.vercel.app/admin/reset-password',
    });
    setResetLoading(false);
    if (resetError) {
      setError('Failed to send reset email: ' + resetError.message);
    } else {
      setResetSent(true);
    }
  }

  if (resetSent) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <h2>Check your email</h2>
        <p style={{ color: '#555' }}>
          We sent a password reset link to <strong>{email}</strong>. Click it to set a new password.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Admin login</h1>
      <form onSubmit={handleLogin}>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#a33c26', fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: 12, background: '#D9642B', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {loading ? 'Checking...' : 'Log in'}
        </button>
      </form>
      <button
        onClick={handleForgotPassword}
        disabled={resetLoading}
        style={{
          background: 'none', border: 'none', color: '#D9642B', fontSize: 13,
          marginTop: 14, cursor: 'pointer', textDecoration: 'underline',
        }}
      >
        {resetLoading ? 'Sending...' : 'Forgot password?'}
      </button>
    </div>
  );
}
