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

    // Save the safety-net record BEFORE the customer pays.
    // This is critical: if this save fails, there is nothing to fall back on
    // if the customer's browser doesn't come back after paying. So we now
    // retry once, and if it still fails, we refuse to let checkout continue
    // rather than silently letting a payment happen with no safety net.
    async function savePendingOrder() {
      return supabaseAdmin
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
    }

    let { error: pendingError } = await savePendingOrder();

    if (pendingError) {
      console.error('Pending order save failed, retrying once:', pendingError);
      ({ error: pendingError } = await savePendingOrder());
    }

    if (pendingError) {
      console.error('Pending order save failed after retry — blocking checkout:', pendingError);
      return NextResponse.json(
        { error: 'Could not start checkout safely. Please try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
