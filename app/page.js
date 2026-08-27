'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

function getOrderStatus(now, windows, closedMessage) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  for (const w of windows) {
    const openMin = toMin(w.order_open);
    const closeMin = toMin(w.order_close);
    if (nowMin >= openMin && nowMin < closeMin) {
      return { isOpen: true, window: w, closesInMinutes: closeMin - nowMin };
    }
  }
  return { isOpen: false, message: closedMessage };
}

function isItemTimeAvailable(item, now) {
  if (!item.available_start_time || !item.available_end_time) return true;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const startMin = toMin(item.available_start_time);
  const endMin = toMin(item.available_end_time);

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  } else {
    return nowMin >= startMin || nowMin < endMin;
  }
}

function normalizeCategory(text) {
  return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function Home() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState([]);
  const [windows, setWindows] = useState([]);
  const [closedMessage, setClosedMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(new Date());
  const [categoryButtons, setCategoryButtons] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('hb_cart') || '{}');
    setCart(savedCart);

    async function loadData() {
      const [itemsRes, windowsRes, settingsRes, catButtonsRes] = await Promise.all([
        supabase.from('menu_items').select('*').eq('in_stock', true),
        supabase.from('order_windows').select('*').eq('is_active', true),
        supabase.from('app_settings').select('closed_message').limit(1).single(),
        supabase.from('category_buttons').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      setMenuItems(itemsRes.data || []);
      setWindows(windowsRes.data || []);
      setClosedMessage(settingsRes.data?.closed_message || 'Ordering is currently closed.');
      setCategoryButtons(catButtonsRes.data || []);
      setLoading(false);
    }
    loadData();

    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('hb_cart', JSON.stringify(cart));
  }, [cart]);

  const status = getOrderStatus(now, windows, closedMessage);

  useEffect(() => {
    if (status.isOpen && status.window) {
      localStorage.setItem('hb_window_id', status.window.id);
    }
  }, [status.isOpen, status.window]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading menu...</div>;
  }

  const timeAvailableItems = menuItems.filter((item) => isItemTimeAvailable(item, now));

  const categoryFilteredItems = activeCategory
    ? timeAvailableItems.filter((item) => normalizeCategory(item.category) === normalizeCategory(activeCategory))
    : timeAvailableItems;

  const searchLower = search.trim().toLowerCase();
  const filteredItems = searchLower
    ? categoryFilteredItems.filter((item) =>
        (item.name || '').toLowerCase().includes(searchLower) ||
        (item.description || '').toLowerCase().includes(searchLower) ||
        (item.category || '').toLowerCase().includes(searchLower)
      )
    : categoryFilteredItems;

  const grouped = filteredItems.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  function addItem(id) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }
  function removeItem(id) {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  return (
    <div style={{ boxSizing: 'border-box', maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 12, paddingBottom: cartCount > 0 ? 74 : 12, background: '#FFF8EE', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Hungry Buds</h1>
        <button
          onClick={() => router.push('/my-orders')}
          style={{
            background: 'none', border: '1.5px solid #D9642B', color: '#D9642B',
            fontWeight: 700, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
          }}
        >
          My Orders
        </button>
      </div>

      <div style={{
        boxSizing: 'border-box', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12,
        background: status.isOpen ? '#e6f5e9' : '#fdeeea',
        color: status.isOpen ? '#256029' : '#a33c26', fontWeight: 600,
      }}>
        {status.isOpen ? `Ordering open — closes in ${status.closesInMinutes} minutes` : status.message}
      </div>

      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a dish..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px',
            borderRadius: 10,
            border: '1.5px solid #eee',
            background: '#fff',
            fontSize: 13,
            color: '#2B2118',
            outline: 'none',
          }}
        />
      </div>

      {categoryButtons.length > 0 && (
        <div style={{
          boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12,
        }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 18, fontWeight: 700, fontSize: 11,
              border: activeCategory === null ? 'none' : '1.5px solid #ddd',
              background: activeCategory === null ? '#D9642B' : '#fff',
              color: activeCategory === null ? '#fff' : '#2B2118',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            All
          </button>
          {categoryButtons.map((btn) => {
            const isActive = activeCategory && normalizeCategory(activeCategory) === normalizeCategory(btn.category_value);
            return (
              <button
                key={btn.id}
                onClick={() => setActiveCategory(isActive ? null : btn.category_value)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 18, fontWeight: 700, fontSize: 11,
                  border: isActive ? 'none' : '1.5px solid #ddd',
                  background: isActive ? '#D9642B' : '#fff',
                  color: isActive ? '#fff' : '#2B2118',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      )}

      {Object.keys(grouped).length === 0 && searchLower && (
        <p style={{ color: '#777' }}>No dishes match "{search}".</p>
      )}
      {Object.keys(grouped).length === 0 && !searchLower && <p>No menu items found yet.</p>}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8, fontWeight: 800, color: '#2B2118' }}>{category}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} style={{
                  boxSizing: 'border-box', display: 'flex', gap: 8, background: '#fff', borderRadius: 12,
                  border: '1px solid #eee', padding: 8, alignItems: 'center',
                }}>
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: '#F6C877' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, border: '2px solid', borderColor: item.veg ? '#2e7d32' : '#c62828', flexShrink: 0 }} />
                      <strong style={{ color: '#2B2118', fontSize: 13 }}>{item.name}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#777', margin: '2px 0 4px' }}>{item.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>₹{item.price}</span>
                      {status.isOpen ? (
                        qty === 0 ? (
                          <button onClick={() => addItem(item.id)} style={{ border: '1.5px solid #D9642B', background: '#fff', color: '#D9642B', fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>ADD</button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#D9642B', borderRadius: 7, padding: '3px 8px' }}>
                            <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>−</button>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{qty}</span>
                            <button onClick={() => addItem(item.id)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+</button>
                          </div>
                        )
                      ) : (
                        <span style={{ fontSize: 11, color: '#999' }}>Closed</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {cartCount > 0 && status.isOpen && (
        <div style={{
          boxSizing: 'border-box', position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 460, margin: '0 auto',
          background: '#2B2118', color: '#fff', padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '18px 18px 0 0',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#C9B8A4' }}>{cartCount} item{cartCount > 1 ? 's' : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>₹{cartTotal}</div>
          </div>
          <button onClick={() => router.push('/cart')} style={{ background: '#D9642B', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            View cart →
          </button>
        </div>
      )}
    </div>
  );
}
