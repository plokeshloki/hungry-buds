'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setSession(data.session);
      setChecking(false);
    }
    checkSession();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  if (checking) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', fontFamily: 'sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Admin Dashboard</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>
        Logged in as {session?.user?.email}
      </p>
      
        href="/admin/menu"
        style={{
          display: 'inline-block', padding: '10px 16px', background: '#2e7d32', color: '#fff',
          borderRadius: 8, fontWeight: 700, textDecoration: 'none', marginBottom: 20,
        }}
      >
        Manage Menu
      </a>
      <p style={{ color: '#888', marginBottom: 24 }}>
        Order windows and reports will go here next.
      </p>
      <button
        onClick={handleLogout}
        style={{
          padding: 12, background: '#D9642B', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Log out
      </button>
    </div>
  );
}
