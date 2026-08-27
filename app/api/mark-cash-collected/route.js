import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({ cash_collected: true, status: 'paid' })
      .eq('id', orderId)
      .eq('payment_method', 'cod');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Mark cash collected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
