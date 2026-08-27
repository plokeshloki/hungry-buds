import { NextResponse } from 'next/server';
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
  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('cod_enabled')
      .limit(1)
      .single();

    if (!settings?.cod_enabled) {
      return NextResponse.json({ error: 'Cash on Delivery is not available right now.' }, { status: 400 });
    }

    const body = await request.json();
    const { phone, name, college, lineItems, subtotal, handlingFee, total } = body;

    if (!phone || !name || !college || !lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
    }

    const orderWindowId = await getCurrentWindowId();
    if (!orderWindowId) {
      return NextResponse.json({ error: 'Ordering is currently closed.' }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .upsert({ phone, name, college_name: college }, { onConflict: 'phone' })
      .select('id')
      .single();
    if (customerError) throw customerError;

    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer.id,
        order_window_id: orderWindowId,
        status: 'cod_pending',
        subtotal,
        handling_fee: handlingFee,
        total_amount: total,
        payment_method: 'cod',
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
    console.error('COD order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
