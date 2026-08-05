import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      phone,
      name,
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

    let { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .limit(1)
      .single();

    let customerId;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabaseAdmin
        .from('customers')
        .update({ name })
        .eq('id', customerId);
    } else {
      const { data: newCustomer, error: custError } = await supabaseAdmin
        .from('customers')
        .insert({ phone, name })
        .select()
        .single();
      if (custError) throw custError;
      customerId = newCustomer.id;
    }

    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customerId,
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
