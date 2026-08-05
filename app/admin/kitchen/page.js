'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function KitchenSummary() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [windows, setWindows] = useState([]);
  const [selectedWindow, setSelectedWindow] = useState('');
  const [summary, setSummary] = useState([]);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/admin');
        return;
      }
      setChecking(false);
      const { data: windowData } = await supabase
        .from('order_windows')
        .select('*')
        .order('id', { ascending: true });
      setWindows(windowData || []);
      if (windowData && windowData.length > 0) {
        setSelectedWindow(windowData[0].id);
      }
    }
    init();
  }, [router]);

  useEffect(() => {
    if (selectedWindow) {
      loadSummary(selectedWindow);
    }
  }, [selectedWindow]);

  async function loadSummary(windowId) {
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'paid')
      .eq('order_window_id', windowId)
      .gte('created_at', todayStart.toISOString());

    if (orderError || !orders) {
      setSummary([]);
      setOrderCount(0);
      setLoading(false);
      return;
    }

    setOrderCount(orders.length);

    if (orders.length === 0) {
      setSummary([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map((o) => o.id);

    const { data: items } = await supabase
      .from('order_items')
      .select('item_name, quantity')
      .in('order_id', orderIds);

    const totals = {};
    (items || []).forEach((item) => {
      totals[item.item_name] = (totals[item.item_name] || 0) + item.quantity;
    });

    const summaryArray = Object.entries(totals)
      .map(([item_name, total_quantity]) => ({ item_name, total_quantity }))
      .sort((a, b) => b.total_quantity - a.total_quantity);

    setSummary(summaryArray);
    setLoading(false);
  }

  if (checking) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '30px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Kitchen Summary</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        Total quantity to cook for today's paid orders, per item.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {windows.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedWindow(w.id)}
            style={{
              flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              background: selectedWindow === w.id ? '#D9642B' : '#eee',
              color: selectedWindow === w.id ? '#fff' : '#333',
            }}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading summary...</p>}

      {!loading && (
        <>
          <p style={{ color: '#666', marginBottom: 12, fontSize: 13 }}>
            {orderCount} paid order(s) today for this window
          </p>

          {summary.length === 0 && <p style={{ color: '#888' }}>No paid orders yet for this window today.</p>}

          {summary.map((row) => (
            <div
              key={row.item_name}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', border: '1px solid #ddd', borderRadius: 10, marginBottom: 10,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 16 }}>{row.item_name}</span>
              <span style={{
                fontWeight: 700, fontSize: 18, background: '#fff3e6', color: '#D9642B',
                padding: '4px 14px', borderRadius: 8,
              }}>
                × {row.total_quantity}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
