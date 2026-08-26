import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,
      phone,
      name,
      college,
      lineItems,
      subtotal,
      handlingFee,
      orderWindowId,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!phone || !name || !college || !lineItems) {
      return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise, not rupees
      currency: 'INR',
      receipt: `hb_${Date.now()}`,
    });

    // Save the order details right now, before the customer even opens their UPI app.
    // This means even if their phone/browser doesn't come back properly after paying,
    // the webhook can still find everything it needs to save the order.
    const { error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .insert({
        razorpay_order_id: order.id,
        phone,
        name,
        college,
        line_items: lineItems,
        subtotal,
        handling_fee: handlingFee,
        total: amount,
        order_window_id: orderWindowId || null,
      });

    if (pendingError) {
      console.error('Could not save pending order:', pendingError);
      // Don't block checkout just because this safety-net save failed —
      // the normal flow can still work fine without it.
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
