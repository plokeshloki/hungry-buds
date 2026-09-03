'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

// Retries a Supabase query a few times if it comes back with an error
// (e.g. a temporary 401/network hiccup from Supabase's side), instead of
// silently giving up on the very first failure.
async function queryWithRetry(queryFn, retries = 3, delayMs = 700) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { data, error } = await queryFn();
    if (!error) {
      return { data, error: null };
    }
    lastError = error;
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { data: null, error: lastError };
}

export default function MyOrders() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setLoading(true);
    setOrders(null);
    setCustomerName('');

    const { data: customer, error: customerError } = await queryWithRetry(() =>
      supabase
        .from('customers')
        .select('id, name')
        .eq('phone', phone)
        .maybeSingle()
    );

    if (customerError) {
      setError('Having trouble loading your orders right now. Please wait a moment and tap View again.');
      setLoading(false);
      return;
    }

    if (!customer) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setCustomerName(customer.name || '');

    const { data: orderRows, error: ordersError } = await queryWithRetry(() =>
      supabase
        .from('orders')
        .select('id, created_at, status, total_amount')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20)
    );

    if (ordersError) {
      setError('Having trouble loading your orders right now. Please wait a moment and tap View again.');
      setLoading(false);
      return;
    }

    const ordersWithItems = await Promise.all(
      (orderRows || []).map(async (order) => {
        const { data: items, error: itemsError } = await queryWithRetry(() =>
          supabase
            .from('order_items')
            .select('item_name, quantity, unit_price')
            .eq('order_id', order.id)
        );
        return { ...order, items: itemsError ? [] : (items || []) };
      })
    );

    setOrders(ordersWithItems);
    setLoading(false);
  }

  return (
    <div style={{ boxSizing: 'border-box', maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 12, background: '#FFF8EE', minHeight: '100vh' }}>
      <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', fontSize: 12, marginBottom: 8, cursor: 'pointer' }}>
        ← Back to menu
      </button>

      <h1 style={{ fontSize: 18, marginBottom: 4 }}>My Orders</h1>
      <p style={{ fontSize: 12, color: '#777', marginBottom: 12 }}>
        Enter the phone number you used when ordering to see your past orders.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="tel"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="10-digit mobile number"
          style={{
            flex: 1, padding: 9, borderRadius: 8, border: '1px solid #ccc',
            fontSize: 13, boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '9px 16px', background: '#D9642B', color: '#fff', border: 'none',
            borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          View
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, background: '#fdeeee', color: '#a33c26', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ fontSize: 13 }}>Loading your orders...</p>}

      {orders !== null && !loading && orders.length === 0 && (
        <p style={{ fontSize: 13, color: '#777' }}>No orders found for this number.</p>
      )}

      {orders !== null && orders.length > 0 && (
        <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          {customerName ? `Showing ${orders.length} order${orders.length > 1 ? 's' : ''} for ${customerName}` : `Showing ${orders.length} order${orders.length > 1 ? 's' : ''}`}
        </p>
      )}

      {orders?.map((order) => (
        <div key={order.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>
              {new Date(order.created_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: order.status === 'paid' ? '#e6f4ea' : '#fdeeee',
                color: order.status === 'paid' ? '#2e7d32' : '#a33c26',
              }}
            >
              {order.status.toUpperCase()}
            </span>
          </div>

          {order.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
              <span>{item.item_name} × {item.quantity}</span>
              <span>₹{item.unit_price * item.quantity}</span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #eee', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
            <span>Total</span>
            <span>₹{order.total_amount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
