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
  const [codCount, setCodCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState('window'); // 'window' or 'custom'
  const [customFrom, setCustomFrom] = useState('17:00');
  const [customTo, setCustomTo] = useState('18:45');

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
    if (mode === 'window' && selectedWindow) {
      loadSummaryByWindow(selectedWindow);
    }
  }, [selectedWindow, mode]);

  async function loadSummaryByWindow(windowId) {
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_method')
      .in('status', ['paid', 'cod_pending'])
      .eq('order_window_id', windowId)
      .gte('created_at', todayStart.toISOString());

    if (orderError || !orders) {
      setSummary([]);
      setOrderCount(0);
      setCodCount(0);
      setLoading(false);
      return;
    }

    await loadItemsForOrders(orders);
  }

  async function loadSummaryByCustomRange() {
    setLoading(true);

    const now = new Date();
    const [fromH, fromM] = customFrom.split(':').map(Number);
    const [toH, toM] = customTo.split(':').map(Number);

    const fromDate = new Date(now);
    fromDate.setHours(fromH, fromM, 0, 0);

    const toDate = new Date(now);
    toDate.setHours(toH, toM, 0, 0);

    if (toDate <= fromDate) {
      alert('"To" time must be after "From" time.');
      setLoading(false);
      return;
    }

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_method')
      .in('status', ['paid', 'cod_pending'])
      .gte('created_at', fromDate.toISOString())
      .lt('created_at', toDate.toISOString());

    if (orderError || !orders) {
      setSummary([]);
      setOrderCount(0);
      setCodCount(0);
      setLoading(false);
      return;
    }

    await loadItemsForOrders(orders);
  }

  async function loadItemsForOrders(orders) {
    setOrderCount(orders.length);
    setCodCount(orders.filter((o) => o.payment_method === 'cod').length);

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
        Total quantity to cook for today's confirmed orders (paid online + cash on delivery), per item.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode('window')}
          style={{
            flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: mode === 'window' ? '#2B2118' : '#eee',
            color: mode === 'window' ? '#fff' : '#333',
          }}
        >
          By Window
        </button>
        <button
          onClick={() => setMode('custom')}
          style={{
            flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: mode === 'custom' ? '#2B2118' : '#eee',
            color: mode === 'custom' ? '#fff' : '#333',
          }}
        >
          Custom Time Range
        </button>
      </div>

      {mode === 'window' && (
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
      )}

      {mode === 'custom' && (
        <div style={{ border: '1px dashed #D9642B', borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8, color: '#D9642B' }}>
            Pick a time range for today
          </label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>From</label>
              <input
                type="time"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box', fontSize: 14 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>To</label>
              <input
                type="time"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box', fontSize: 14 }}
              />
            </div>
          </div>
          <button
            onClick={loadSummaryByCustomRange}
            style={{
              width: '100%', padding: 10, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Show Orders in This Range
          </button>
        </div>
      )}

      {loading && <p>Loading summary...</p>}

      {!loading && (
        <>
          <p style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>
            {orderCount} confirmed order(s) today for this {mode === 'window' ? 'window' : 'time range'}
          </p>
          {codCount > 0 && (
            <p style={{ color: '#b06a00', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
              Includes {codCount} Cash on Delivery order(s) — collect payment on delivery
            </p>
          )}

          {summary.length === 0 && <p style={{ color: '#888' }}>No confirmed orders yet for this {mode === 'window' ? 'window' : 'time range'} today.</p>}

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
