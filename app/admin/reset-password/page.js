'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      } else {
        setError('This reset link is invalid or has expired. Please request a new one.');
      }
    }
    checkSession();
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('Failed to update password: ' + updateError.message);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <h2>Password updated!</h2>
        <p style={{ color: '#555', marginBottom: 20 }}>You can now log in with your new password.</p>
        <button
          onClick={() => router.push('/admin')}
          style={{
            padding: 12, background: '#D9642B', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Set new password</h1>

      {!ready && error && <p style={{ color: '#a33c26', fontSize: 14 }}>{error}</p>}

      {ready && (
        <form onSubmit={handleReset}>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6 }}>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6 }}>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}
