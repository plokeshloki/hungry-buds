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

    // These two don't depend on each other, so run them at the same time instead of one after another
    const [orderWindowId, customerResult] = await Promise.all([
      getCurrentWindowId(),
      supabaseAdmin
        .from('customers')
        .upsert({ phone, name, college_name: college }, { onConflict: 'phone' })
        .select('id')
        .single(),
    ]);

    if (customerResult.error) throw customerResult.error;
    const customerId = customerResult.data.id;

    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customerId,
        order_window_id: orderWindowId,
        status: 'paid',
        subtotal,
        handling_fee: handlingFee,
        total_amount: total,
        razorpay_order_id,
        razorpay_payment_id,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const orderItemsToInsert = lineItems.map((item) => ({
      order_id: newOrder.id,
      menu_item_id: item.id,
      item_name: item.name,
      unit_price: item.price,
      quantity: item.qty,
    }));
    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsToInsert);
    if (itemsError) throw itemsError;

    return NextResponse.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error('Verify order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
