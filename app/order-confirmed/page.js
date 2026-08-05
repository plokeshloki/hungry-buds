'use client';
import { useRouter } from 'next/navigation';

export default function OrderConfirmed() {
  const router = useRouter();

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center', minHeight: '100vh', background: '#FFF8EE' }}>
      <div style={{ marginTop: 60, fontSize: 48 }}>✅</div>
      <h1 style={{ fontSize: 24, marginTop: 16 }}>Order confirmed!</h1>
      <p style={{ color: '#555', marginTop: 12 }}>
        Your payment was successful. Head to the pickup counter at your window's pickup time.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: 30, padding: '12px 24px', background: '#D9642B', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Back to menu
      </button>
    </div>
  );
}
