import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getIndiaNow() {
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
  // IMPORTANT: read the raw text first — signature verification needs the
  // exact original bytes Razorpay sent, not a re-serialized JSON copy.
  const rawBody = await request.text();

  const signature = request.headers.get('x-razorpay-signature');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Webhook signature mismatch — ignoring request.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== 'payment.captured') {
    // We only care about successful payments. Acknowledge anything else quietly.
    return NextResponse.json({ received: true });
  }

  try {
    const payment = payload.payload.payment.entity;
    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    // If this payment was already saved by the normal checkout flow, don't save it twice.
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({ received: true, alreadySaved: true });
    }

    // Look up the order details we saved the moment checkout started.
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('pending_orders')
      .select('*')
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle();

    if (pendingError || !pending) {
      console.error('Webhook: no pending order found for', razorpayOrderId, pendingError);
      // Acknowledge anyway so Razorpay doesn't keep retrying — but this is logged
      // so it can be investigated and fixed manually if it ever happens.
      return NextResponse.json({ received: true, warning: 'No matching pending order found' });
    }

    const orderWindowId = pending.order_window_id || (await getCurrentWindowId());

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert(
        { phone: pending.phone, name: pending.name, college_name: pending.college },
        { onConflict: 'phone' }
      )
      .select('id')
      .single();
    if (customerError) throw customerError;

    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer.id,
        order_window_id: orderWindowId,
        status: 'paid',
        subtotal: pending.subtotal,
        handling_fee: pending.handling_fee,
        total_amount: pending.total,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const orderItemsToInsert = pending.line_items.map((item) => ({
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

    // Clean up — this order is now safely saved, no need to keep the pending copy.
    await supabaseAdmin.from('pending_orders').delete().eq('razorpay_order_id', razorpayOrderId);

    console.log('Webhook saved order', newOrder.id, 'for payment', razorpayPaymentId);
    return NextResponse.json({ received: true, orderId: newOrder.id });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Still return 200-ish acknowledgement isn't ideal here — return 500 so
    // Razorpay retries this specific webhook delivery a few times automatically.
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
