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
  const [markingId, setMarkingId] = useState(null);

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
    setError('');

    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at, status, total_amount, customer_id, payment_method, cash_collected')
      .order('created_at', { ascending: false })
      .limit(50);

    if (orderError) {
      setError('Failed to load orders: ' + orderError.message);
      setLoadingOrders(false);
      return;
    }

    if (!orderRows || orderRows.length === 0) {
      setAllOrders([]);
      setLoadingOrders(false);
      return;
    }

    const orderIds = orderRows.map((o) => o.id);
    const customerIds = [...new Set(orderRows.map((o) => o.customer_id).filter(Boolean))];

    const [customersRes, itemsRes] = await Promise.all([
      supabase.from('customers').select('id, name, phone, college_name').in('id', customerIds),
      supabase.from('order_items').select('order_id, item_name, quantity, unit_price').in('order_id', orderIds),
    ]);

    if (customersRes.error) {
      setError('Failed to load customer details: ' + customersRes.error.message);
      setLoadingOrders(false);
      return;
    }
    if (itemsRes.error) {
      setError('Failed to load order items: ' + itemsRes.error.message);
      setLoadingOrders(false);
      return;
    }

    const customerById = {};
    (customersRes.data || []).forEach((c) => {
      customerById[c.id] = c;
    });

    const itemsByOrderId = {};
    (itemsRes.data || []).forEach((item) => {
      if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
      itemsByOrderId[item.order_id].push(item);
    });

    const ordersWithDetails = orderRows.map((order) => ({
      ...order,
      customer: customerById[order.customer_id] || null,
      items: itemsByOrderId[order.id] || [],
    }));

    setAllOrders(ordersWithDetails);
    setLoadingOrders(false);
  }

  async function markCashCollected(orderId) {
    setMarkingId(orderId);
    try {
      const res = await fetch('/api/mark-cash-collected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAllOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, cash_collected: true, status: 'paid' } : o))
        );
      } else {
        alert(data.error || 'Could not mark as collected. Please try again.');
      }
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
    setMarkingId(null);
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

      {filteredOrders.map((order) => {
        const isCod = order.payment_method === 'cod';
        const needsCollection = isCod && !order.cash_collected;
        return (
          <div
            key={order.id}
            style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <strong>{order.customer?.name || 'No name'}</strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {isCod && (
                  <span
                    style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: '#fff3e0', color: '#b06a00',
                    }}
                  >
                    CASH ON DELIVERY
                  </span>
                )}
                <span
                  style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: order.status === 'paid' ? '#e6f4ea' : (order.status === 'cod_pending' ? '#fff3e0' : '#fdeeee'),
                    color: order.status === 'paid' ? '#2e7d32' : (order.status === 'cod_pending' ? '#b06a00' : '#a33c26'),
                  }}
                >
                  {order.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
              {order.customer?.phone} • {order.customer?.college_name || 'No college'} • {new Date(order.created_at).toLocaleString('en-IN', {
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

            {needsCollection && (
              <button
                onClick={() => markCashCollected(order.id)}
                disabled={markingId === order.id}
                style={{
                  width: '100%', marginTop: 10, padding: 10, background: '#D9642B', color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {markingId === order.id ? 'Marking...' : 'Mark Cash Collected'}
              </button>
            )}

            {isCod && order.cash_collected && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#2e7d32' }}>
                ✓ Cash collected
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
