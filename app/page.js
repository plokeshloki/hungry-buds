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
      return {
        isOpen: true,
        window: w,
        closesInMinutes: closeMin - nowMin,
      };
    }
  }

  return {
    isOpen: false,
    message: closedMessage,
  };
}

function isItemTimeAvailable(item, now) {
  if (!item.available_start_time || !item.available_end_time) {
    return true;
  }

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

// Matches loosely: ignores capital/lowercase letters and extra spaces.
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
      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('in_stock', true);

      const { data: windowRows } = await supabase
        .from('order_windows')
        .select('*')
        .eq('is_active', true);

      const { data: settings } = await supabase
        .from('app_settings')
        .select('closed_message')
        .limit(1)
        .single();

      const { data: catButtons } = await supabase
        .from('category_buttons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      setMenuItems(items || []);
      setWindows(windowRows || []);
      setClosedMessage(
        settings?.closed_message || 'Ordering is currently closed.'
      );
      setCategoryButtons(catButtons || []);
      setLoading(false);
    }

    loadData();

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);

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
    return (
      <div
        style={{
          padding: 40,
          fontFamily: 'sans-serif',
          fontSize: 16,
        }}
      >
        Loading menu...
      </div>
    );
  }

  const timeAvailableItems = menuItems.filter((item) =>
    isItemTimeAvailable(item, now)
  );

  const categoryFilteredItems = activeCategory
    ? timeAvailableItems.filter(
        (item) =>
          normalizeCategory(item.category) ===
          normalizeCategory(activeCategory)
      )
    : timeAvailableItems;

  const searchLower = search.trim().toLowerCase();

  const filteredItems = searchLower
    ? categoryFilteredItems.filter(
        (item) =>
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
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  }

  function removeItem(id) {
    setCart((prev) => {
      const next = { ...prev };

      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }

      return next;
    });
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        boxSizing: 'border-box',
        margin: '0 auto',
        fontFamily: 'sans-serif',
        padding: '14px 14px',
        paddingBottom: cartCount > 0 ? 100 : 20,
        background: '#FFF8EE',
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: 27,
          margin: '4px 0 14px',
          fontWeight: 800,
          color: '#2B2118',
        }}
      >
        Hungry Buds
      </h1>

      <div
        style={{
          padding: '13px 14px',
          borderRadius: 12,
          marginBottom: 16,
          background: status.isOpen ? '#e6f5e9' : '#fdeeea',
          color: status.isOpen ? '#256029' : '#a33c26',
          fontWeight: 700,
          fontSize: 15,
          lineHeight: 1.4,
        }}
      >
        {status.isOpen
          ? `Ordering open — closes in ${status.closesInMinutes} minutes`
          : status.message}
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
            padding: '14px 15px',
            borderRadius: 13,
            border: '1.5px solid #eee',
            background: '#fff',
            fontSize: 16,
            color: '#2B2118',
            outline: 'none',
          }}
        />
      </div>

      {categoryButtons.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            marginBottom: 20,
            paddingBottom: 5,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              flexShrink: 0,
              padding: '10px 17px',
              minHeight: 40,
              borderRadius: 22,
              fontWeight: 700,
              fontSize: 14,
              border:
                activeCategory === null
                  ? 'none'
                  : '1.5px solid #ddd',
              background:
                activeCategory === null ? '#D9642B' : '#fff',
              color:
                activeCategory === null ? '#fff' : '#2B2118',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>

          {categoryButtons.map((btn) => {
            const isActive =
              activeCategory &&
              normalizeCategory(activeCategory) ===
                normalizeCategory(btn.category_value);

            return (
              <button
                key={btn.id}
                onClick={() =>
                  setActiveCategory(
                    isActive ? null : btn.category_value
                  )
                }
                style={{
                  flexShrink: 0,
                  padding: '10px 17px',
                  minHeight: 40,
                  borderRadius: 22,
                  fontWeight: 700,
                  fontSize: 14,
                  border: isActive
                    ? 'none'
                    : '1.5px solid #ddd',
                  background: isActive ? '#D9642B' : '#fff',
                  color: isActive ? '#fff' : '#2B2118',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      )}

      {Object.keys(grouped).length === 0 && searchLower && (
        <p
          style={{
            color: '#777',
            fontSize: 16,
          }}
        >
          No dishes match "{search}".
        </p>
      )}

      {Object.keys(grouped).length === 0 && !searchLower && (
        <p style={{ fontSize: 16 }}>No menu items found yet.</p>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 30 }}>
          <h2
            style={{
              fontSize: 21,
              marginBottom: 13,
              fontWeight: 800,
              color: '#2B2118',
            }}
          >
            {category}
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {items.map((item) => {
              const qty = cart[item.id] || 0;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 13,
                    background: '#fff',
                    borderRadius: 16,
                    border: '1px solid #eee',
                    padding: 12,
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 13,
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: 13,
                        flexShrink: 0,
                        background: '#F6C877',
                      }}
                    />
                  )}

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 7,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 11,
                          height: 11,
                          border: '2px solid',
                          borderColor: item.veg
                            ? '#2e7d32'
                            : '#c62828',
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      />

                      <strong
                        style={{
                          color: '#2B2118',
                          fontSize: 17,
                          lineHeight: 1.3,
                          fontWeight: 700,
                        }}
                      >
                        {item.name}
                      </strong>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.35,
                        color: '#777',
                        margin: '4px 0 7px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.description}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 17,
                          color: '#2B2118',
                        }}
                      >
                        ₹{item.price}
                      </span>

                      {status.isOpen ? (
                        qty === 0 ? (
                          <button
                            onClick={() => addItem(item.id)}
                            style={{
                              border: '1.5px solid #D9642B',
                              background: '#fff',
                              color: '#D9642B',
                              fontWeight: 800,
                              fontSize: 14,
                              padding: '8px 17px',
                              minHeight: 40,
                              borderRadius: 9,
                              cursor: 'pointer',
                            }}
                          >
                            ADD
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              background: '#D9642B',
                              borderRadius: 9,
                              padding: '4px 9px',
                              minHeight: 40,
                              boxSizing: 'border-box',
                            }}
                          >
                            <button
                              onClick={() => removeItem(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 21,
                                cursor: 'pointer',
                                padding: '0 4px',
                              }}
                            >
                              −
                            </button>

                            <span
                              style={{
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 16,
                                minWidth: 18,
                                textAlign: 'center',
                              }}
                            >
                              {qty}
                            </span>

                            <button
                              onClick={() => addItem(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 21,
                                cursor: 'pointer',
                                padding: '0 4px',
                              }}
                            >
                              +
                            </button>
                          </div>
                        )
                      ) : (
                        <span
                          style={{
                            fontSize: 13,
                            color: '#999',
                          }}
                        >
                          Closed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {cartCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            maxWidth: 520,
            margin: '0 auto',
            boxSizing: 'border-box',
            background: '#2B2118',
            color: '#fff',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            borderRadius: '18px 18px 0 0',
            boxShadow: '0 -3px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: '#C9B8A4',
                marginBottom: 2,
              }}
            >
              {cartCount} item{cartCount > 1 ? 's' : ''}
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              ₹{cartTotal}
            </div>
          </div>

          <button
            onClick={() => router.push('/cart')}
            style={{
              background: '#D9642B',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              minHeight: 44,
              borderRadius: 11,
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            View cart →
          </button>
        </div>
      )}
    </div>
  );
}
