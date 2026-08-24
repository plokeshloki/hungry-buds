'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

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

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [handlingFee, setHandlingFee] = useState(5);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [windows, setWindows] = useState([]);
  const [closedMessage, setClosedMessage] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('hb_cart') || '{}');
    setCart(savedCart);
    async function loadData() {
      const { data: items } = await supabase.from('menu_items').select('*');
      const { data: settings } = await supabase.from('app_settings').select('handling_fee, closed_message').limit(1).single();
      const { data: windowRows } = await supabase.from('order_windows').select('*').eq('is_active', true);
      setMenuItems(items || []);
      setHandlingFee(settings?.handling_fee ?? 5);
      setClosedMessage(settings?.closed_message || 'Ordering is currently closed.');
      setWindows(windowRows || []);
      setLoading(false);
    }
    loadData();

    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
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

  const status = getOrderStatus(now, windows, closedMessage);

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
    if (!status.isOpen) {
      alert('Sorry, ordering has closed. Please come back when ordering reopens.');
      return;
    }
    if (!name.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!college.trim()) {
      alert('Please enter your college name.');
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
          setConfirming(true);
          const verifyRes = await fetch('/api/verify-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              phone,
              name,
              college,
              orderWindowId: localStorage.getItem('hb_window_id') || null,
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
            setConfirming(false);
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
        config: {
          display: {
            hide: [
              { method: 'paylater' },
              { method: 'wallet' },
              { method: 'emi' },
            ],
          },
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
    <div style={{ boxSizing: 'border-box', maxWidth: 460, margin: '0 auto', fontFamily: 'sans-serif', padding: 10, background: '#FFF8EE', minHeight: '100vh' }}>
      {confirming && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255, 248, 238, 0.97)', zIndex: 999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '4px solid #f0d9c0', borderTopColor: '#D9642B',
            animation: 'hb-spin 0.8s linear infinite',
          }} />
          <p style={{ marginTop: 20, fontSize: 16, fontWeight: 600, color: '#333' }}>
            Payment received — confirming your order...
          </p>
          <p style={{ marginTop: 4, fontSize: 13, color: '#888' }}>
            This usually takes just a few seconds. Please don't close this page.
          </p>
          <style>{`@keyframes hb-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
        ← Back to menu
      </button>

      <h1 style={{ fontSize: 17, marginBottom: 8 }}>Your cart</h1>

      {lineItems.length === 0 && <p style={{ fontSize: 13 }}>Your cart is empty.</p>}

      {lineItems.map((item) => (
        <div key={item.id} style={{
          display: 'flex', justifyContent: 'space-between', padding: '6px 0',
          borderBottom: '1px solid #eee',
        }}>
          <div>
            <strong style={{ fontSize: 13 }}>{item.name}</strong>
            <div style={{ fontSize: 11, color: '#777' }}>Qty: {item.qty}</div>
          </div>
          <div style={{ fontSize: 13 }}>₹{item.price * item.qty}</div>
        </div>
      ))}

      {lineItems.length > 0 && !status.isOpen && (
        <div style={{
          marginTop: 12, padding: 12, background: '#fdeeea', color: '#a33c26',
          borderRadius: 10, fontWeight: 600, textAlign: 'center', fontSize: 13,
        }}>
          {status.message || 'Ordering is currently closed.'}
          <div style={{ fontWeight: 400, fontSize: 11, marginTop: 4 }}>
            Your cart is saved — come back when ordering reopens to finish your order.
          </div>
        </div>
      )}

      {lineItems.length > 0 && status.isOpen && (
        <>
          <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 7, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span>Subtotal</span><span>₹{subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#777' }}>
              <span>Handling fee</span><span>₹{handlingFee}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
              <span>Total</span><span>₹{total}</span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }}>
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%', padding: 9, borderRadius: 8, border: '1px solid #ccc',
                fontSize: 13, boxSizing: 'border-box', marginBottom: 8,
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }}>
              Your college name
            </label>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. VIT-AP"
              style={{
                width: '100%', padding: 9, borderRadius: 8, border: '1px solid #ccc',
                fontSize: 13, boxSizing: 'border-box', marginBottom: 8,
              }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 }}>
              Your phone number (for pickup)
            </label>
            <input
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              style={{
                width: '100%', padding: 9, borderRadius: 8, border: '1px solid #ccc',
                fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={handleCheckout}
            disabled={paying}
            style={{
              width: '100%', marginTop: 12, padding: 11, background: '#D9642B', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            {paying ? 'Processing...' : `Pay ₹${total}`}
          </button>
        </>
      )}
    </div>
  );
}
