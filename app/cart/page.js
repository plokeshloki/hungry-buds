'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [phone, setPhone] = useState('');
  const [handlingFee, setHandlingFee] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('hb_cart') || '{}');
    setCart(savedCart);
    async function loadData() {
      const { data: items } = await supabase.from('menu_items').select('*');
      const { data: settings } = await supabase.from('app_settings').select('handling_fee').limit(1).single();
      setMenuItems(items || []);
      setHandlingFee(settings?.handling_fee ?? 5);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading cart...</div>;
  }

  const lineItems = Object.entries(cart)
    .map(([id, qty]) => {
      const item = menuItems.find((m) => m.id === id);
      return item ? { ...item, qty } : null;
    })
    .filter(Boolean);

  const subtotal = lineItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal + (lineItems.length > 0 ? handlingFee : 0);

  function isValidPhone(p) {
    return /^[6-9]\d{9}$/.test(p);
  }

  function handleCheckout() {
    if (!isValidPhone(phone)) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }
    alert(`Checkout not wired to payment yet.\nPhone: ${phone}\nTotal: ₹${total}\n(Razorpay comes next.)`);
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 16, background: '#FFF8EE', minHeight: '100vh' }}>
      <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
        ← Back to menu
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Your cart</h1>

      {lineItems.length === 0 && <p>Your cart is empty.</p>}

      {lineItems.map((item) => (
        <div key={item.id} style={{
          display: 'flex', justifyContent: 'space-between', padding: '10px 0',
          borderBottom: '1px solid #eee',
        }}>
          <div>
            <strong>{item.name}</strong>
            <div style={{ fontSize: 13, color: '#777' }}>Qty: {item.qty}</div>
          </div>
          <div>₹{item.price * item.qty}</div>
        </div>
      ))}

      {lineItems.length > 0 && (
        <>
          <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Subtotal</span><span>₹{subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#777' }}>
              <span>Handling fee</span><span>₹{handlingFee}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}>
              <span>Total</span><span>₹{total}</span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Your phone number (for pickup)
            </label>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc',
                fontSize: 16, boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleCheckout}
            style={{
              width: '100%', marginTop: 20, padding: 14, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}
          >
            Pay ₹{total}
          </button>
        </>
      )}
    </div>
  );
}