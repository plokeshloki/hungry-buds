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
  // If no custom time range is set, item is always available (per your existing logic)
  if (!item.available_start_time || !item.available_end_time) return true;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const startMin = toMin(item.available_start_time);
  const endMin = toMin(item.available_end_time);

  if (startMin <= endMin) {
    // normal range, e.g. 18:00 to 20:00
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // range crosses midnight, e.g. 22:00 to 02:00
    return nowMin >= startMin || nowMin < endMin;
  }
}

// Matches loosely: ignores capital/lowercase letters and extra spaces,
// so "Fast Food", "fast food ", "FAST FOOD" are all treated as the same category.
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
      const { data: items } = await supabase.from('menu_items').select('*').eq('in_stock', true);
      const { data: windowRows } = await supabase.from('order_windows').select('*').eq('is_active', true);
      const { data: settings } = await supabase.from('app_settings').select('closed_message').limit(1).single();
      const { data: catButtons } = await supabase
        .from('category_buttons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      setMenuItems(items || []);
      setWindows(windowRows || []);
      setClosedMessage(settings?.closed_message || 'Ordering is currently closed.');
      setCategoryButtons(catButtons || []);
      setLoading(false);
    }
    loadData();

    // refresh the clock every minute so time-restricted items appear/disappear automatically
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
    <div style={{ maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 16, paddingBottom: cartCount > 0 ? 90 : 16, background: '#FFF8EE', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 27, marginBottom: 14 }}>Hungry Buds</h1>

      <div style={{
        padding: 16, borderRadius: 12, marginBottom: 22, fontSize: 15,
        background: status.isOpen ? '#e6f5e9' : '#fdeeea',
        color: status.isOpen ? '#256029' : '#a33c26', fontWeight: 600,
      }}>
        {status.isOpen ? `Ordering open — closes in ${status.closesInMinutes} minutes` : status.message}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a dish..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1.5px solid #eee',
            background: '#fff',
            fontSize: 16,
            color: '#2B2118',
            outline: 'none',
          }}
        />
      </div>

      {categoryButtons.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20,
          paddingBottom: 4, WebkitOverflowScrolling: 'touch',
        }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              flexShrink: 0, padding: '9px 18px', borderRadius: 20, fontWeight: 700, fontSize: 14,
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
                  flexShrink: 0, padding: '9px 18px', borderRadius: 20, fontWeight: 700, fontSize: 14,
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
        <div key={category} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 21, marginBottom: 13, fontWeight: 800, color: '#2B2118' }}>{category}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 12, background: '#fff', borderRadius: 16,
                  border: '1px solid #eee', padding: 11, alignItems: 'center',
                }}>
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0, background: '#F6C877' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid', borderColor: item.veg ? '#2e7d32' : '#c62828', flexShrink: 0 }} />
                      <strong style={{ color: '#2B2118', fontSize: 16 }}>{item.name}</strong>
                    </div>
                    <div style={{ fontSize: 14, color: '#777', margin: '3px 0 7px' }}>{item.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>₹{item.price}</span>
                      {status.isOpen ? (
                        qty === 0 ? (
                          <button onClick={() => addItem(item.id)} style={{ border: '1.5px solid #D9642B', background: '#fff', color: '#D9642B', fontWeight: 700, fontSize: 14, padding: '6px 16px', borderRadius: 8, cursor: 'pointer' }}>ADD</button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#D9642B', borderRadius: 8, padding: '5px 11px' }}>
                            <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>−</button>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{qty}</span>
                            <button onClick={() => addItem(item.id)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>+</button>
                          </div>
                        )
                      ) : (
                        <span style={{ fontSize: 13, color: '#999' }}>Closed</span>
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
          position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 460, margin: '0 auto',
          background: '#2B2118', color: '#fff', padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#C9B8A4' }}>{cartCount} item{cartCount > 1 ? 's' : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>₹{cartTotal}</div>
          </div>
          <button onClick={() => router.push('/cart')} style={{ background: '#D9642B', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            View cart →
          </button>
        </div>
      )}
    </div>
  );
}
