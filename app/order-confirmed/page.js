'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function OrderConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const method = searchParams.get('method');
  const amount = searchParams.get('amount');
  const isCod = method === 'cod';

  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from('app_settings')
        .select('delivery_message, delivery_time')
        .limit(1)
        .single();
      if (data) {
        setDeliveryMessage(data.delivery_message || '');
        setDeliveryTime(data.delivery_time || '');
      }
    }
    loadSettings();
  }, []);

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center', minHeight: '100vh', background: '#FFF8EE' }}>
      <div style={{ marginTop: 60, fontSize: 52 }}>✅</div>
      <h1 style={{ fontSize: 26, marginTop: 18 }}>Order confirmed!</h1>

      {isCod ? (
        <>
          <p style={{ color: '#555', marginTop: 13, fontSize: 16 }}>
            Your order has been placed. This is <strong>Cash on Delivery</strong> — you have NOT paid yet.
          </p>
          <div style={{
            marginTop: 16, padding: 14, background: '#fff3e0', color: '#b06a00',
            borderRadius: 10, fontWeight: 700, fontSize: 16,
          }}>
            Please pay ₹{amount} in cash when you pick up your order.
          </div>
        </>
      ) : (
        <p style={{ color: '#555', marginTop: 13, fontSize: 16 }}>
          Your payment was successful.
        </p>
      )}

      {deliveryTime && (
        <div style={{
          marginTop: 16, padding: 14, background: '#e6f4ea', color: '#2e7d32',
          borderRadius: 10, fontWeight: 700, fontSize: 16,
        }}>
          Delivery time: {deliveryTime}
        </div>
      )}

      {deliveryMessage && (
        <p style={{ color: '#555', marginTop: 13, fontSize: 15 }}>
          {deliveryMessage}
        </p>
      )}

      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: 32, padding: '13px 26px', background: '#D9642B', color: '#fff',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer',
        }}
      >
        Back to menu
      </button>
    </div>
  );
}

export default function OrderConfirmed() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: 'sans-serif', textAlign: 'center' }}>Loading...</div>}>
      <OrderConfirmedContent />
    </Suspense>
  );
}
