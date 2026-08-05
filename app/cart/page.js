'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [handlingFee, setHandlingFee] = useState(5);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

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

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
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

  async function handleCheckout() {
    if (!name.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!isValidPhone(phone)) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }

    setPaying(true);

    try {
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.order) {
        alert('Could not start payment. Please try again.');
        setPaying(false);
        return;
      }

      const razorpayOrder = createData.order;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        currency: 'INR',
        name: 'Hungry Buds',
        description: 'Campus Delivery Order',
        order_id: razorpayOrder.id,
        handler: async function (response) {
          const verifyRes = await fetch('/api/verify-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              phone,
              name,
              lineItems: lineItems.map((i) => ({
                id: i.id,
                name: i.name,
                price: i.price,
                qty: i.qty,
              })),
              subtotal,
              handlingFee,
              total,
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            localStorage.removeItem('hb_cart');
            router.push('/order-confirmed');
          } else {
            alert('Payment verification failed. If money was deducted, it will be refunded automatically. Please contact the restaurant.');
          }
          setPaying(false);
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
        prefill: {
          contact: phone,
          name: name,
        },
        theme: {
          color: '#D9642B',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Something went wrong starting the payment. Please try again.');
      setPaying(false);
    }
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
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc',
                fontSize: 16, boxSizing: 'border-box', marginBottom: 16,
              }}
            />

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
            disabled={paying}
            style={{
              width: '100%', marginTop: 20, padding: 14, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}
          >
            {paying ? 'Processing...' : `Pay ₹${total}`}
          </button>
        </>
      )}
    </div>
  );
}
