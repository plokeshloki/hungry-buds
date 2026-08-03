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

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
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
    </div>
  );
}
