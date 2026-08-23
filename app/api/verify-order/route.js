import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getIndiaNow() {
  // Server may run in UTC; India is always UTC+5:30, no daylight saving.
  const nowUtc = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(nowUtc.getTime() + istOffsetMs);
}

async function getCurrentWindowId() {
  const { data: windowRows } = await supabaseAdmin
    .from('order_windows')
    .select('*')
    .eq('is_active', true);

  if (!windowRows || windowRows.length === 0) return null;

  const istNow = getIndiaNow();
  const nowMin = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  for (const w of windowRows) {
    const openMin = toMin(w.order_open);
    const closeMin = toMin(w.order_close);
    if (nowMin >= openMin && nowMin < closeMin) {
      return w.id;
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      phone,
      name,
      college,
      lineItems,
      subtotal,
      handlingFee,
      total,
    } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Determine the correct window using the real server time, not the phone's saved value
    const orderWindowId = await getCurrentWindowId();

    // Single database round trip: saves customer, order, and order items all at once
    const { data: newOrderId, error: rpcError } = await supabaseAdmin.rpc('complete_order', {
      p_phone: phone,
      p_name: name,
      p_college: college,
      p_order_window_id: orderWindowId,
      p_subtotal: subtotal,
      p_handling_fee: handlingFee,
      p_total: total,
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_line_items: lineItems,
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({ success: true, orderId: newOrderId });
  } catch (err) {
    console.error('Verify order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
