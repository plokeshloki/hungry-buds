'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function OrderLookup() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState('');
  const [allOrders, setAllOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
      loadRecentOrders();
    }
    init();
  }, [router]);

  async function loadRecentOrders() {
    setLoadingOrders(true);
    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at, status, total_amount, customer_id')
      .order('created_at', { ascending: false })
      .limit(50);

    if (orderError) {
      setError('Failed to load orders: ' + orderError.message);
      setLoadingOrders(false);
      return;
    }

    const ordersWithDetails = await Promise.all(
      orderRows.map(async (order) => {
        const { data: customer } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('id', order.customer_id)
          .single();
        const { data: items } = await supabase
          .from('order_items')
          .select('item_name, quantity, unit_price')
          .eq('order_id', order.id);
        return { ...order, customer, items: items || [] };
      })
    );

    setAllOrders(ordersWithDetails);
    setLoadingOrders(false);
  }

  const filteredOrders = phone
    ? allOrders.filter((o) => o.customer?.phone?.includes(phone))
    : allOrders;

  if (checking) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '30px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Order Lookup</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        Recent orders shown below. Optionally filter by phone number.
      </p>

      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
        maxLength={10}
        placeholder="Filter by phone number (optional)"
        style={{
          width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc',
          fontSize: 14, boxSizing: 'border-box', marginBottom: 20,
        }}
      />

      {error && (
        <div style={{ padding: 10, background: '#fdeeee', color: '#a33c26', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loadingOrders && <p>Loading orders...</p>}

      {!loadingOrders && filteredOrders.length === 0 && (
        <p style={{ color: '#888' }}>No orders found.</p>
      )}

      {!loadingOrders && filteredOrders.length > 0 && (
        <p style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>
          Showing {filteredOrders.length} order(s)
        </p>
      )}

      {filteredOrders.map((order) => (
        <div
          key={order.id}
          style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <strong>{order.customer?.name || 'No name'}</strong>
            <span
              style={{
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: order.status === 'paid' ? '#e6f4ea' : '#fdeeee',
                color: order.status === 'paid' ? '#2e7d32' : '#a33c26',
              }}
            >
              {order.status.toUpperCase()}
            </span>
          </div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
            {order.customer?.phone} • {new Date(order.created_at).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </div>

          {order.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
              <span>{item.item_name} × {item.quantity}</span>
              <span>₹{item.unit_price * item.quantity}</span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #eee', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total</span>
            <span>₹{order.total_amount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
