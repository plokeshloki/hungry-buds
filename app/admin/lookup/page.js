'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function OrderLookup() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
    }
    init();
  }, [router]);

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSearching(true);
    setOrders(null);

    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('phone', phone)
      .limit(1)
      .single();

    if (custError || !customer) {
      setError('No customer found with that phone number.');
      setSearching(false);
      return;
    }

    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at, status, total_amount, subtotal, handling_fee')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (orderError) {
      setError('Failed to load orders: ' + orderError.message);
      setSearching(false);
      return;
    }

    const ordersWithItems = await Promise.all(
      orderRows.map(async (order) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('item_name, quantity, unit_price')
          .eq('order_id', order.id);
        return { ...order, items: items || [] };
      })
    );

    setOrders({ customer, orders: ordersWithItems });
    setSearching(false);
  }

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
        Search a customer's order history by phone number.
      </p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          maxLength={10}
          placeholder="10-digit phone number"
          required
          style={{
            flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc',
            fontSize: 14, boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={searching}
          style={{
            padding: '10px 20px', background: '#D9642B', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ padding: 10, background: '#fdeeee', color: '#a33c26', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {orders && (
        <div>
          <div style={{ marginBottom: 16, padding: 12, background: '#f7f7f7', borderRadius: 8 }}>
            <strong>{orders.customer.name || 'No name on file'}</strong>
            <div style={{ color: '#666', fontSize: 13 }}>{orders.customer.phone}</div>
            <div style={{ color: '#666', fontSize: 13 }}>{orders.orders.length} order(s) found</div>
          </div>

          {orders.orders.map((order) => (
            <div
              key={order.id}
              style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  {new Date(order.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
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
      )}
    </div>
  );
}
