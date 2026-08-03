'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('login'); // 'login' | 'checkEmail'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin/dashboard`,
      },
    });

    setLoading(false);

    if (otpError) {
      setError('Password correct, but failed to send verification email.');
      return;
    }

    setStep('checkEmail');
  }

  if (step === 'checkEmail') {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <h2>Check your email</h2>
        <p style={{ color: '#555' }}>
          We sent a secure sign-in link to <strong>{email}</strong>.
          Click it to finish logging in — this confirms it's really you.
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
          {loading ? 'Checking...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
