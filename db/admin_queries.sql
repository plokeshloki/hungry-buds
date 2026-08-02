-- Hungry Buds — Ready-to-use queries for admin features
-- These become the SQL behind two API routes: /admin/lookup and /admin/kitchen-summary

-- =========================================
-- FEATURE: Per-customer order lookup by phone
-- Input: a phone number typed into the admin search box
-- Output: every order that customer placed, what they ordered, payment status
-- =========================================
select
  o.id as order_id,
  o.created_at,
  o.status,
  o.total_amount,
  c.phone,
  c.name,
  json_agg(json_build_object(
    'item', oi.item_name,
    'qty', oi.quantity,
    'unit_price', oi.unit_price
  )) as items
from orders o
join customers c on c.id = o.customer_id
join order_items oi on oi.order_id = o.id
where c.phone = $1
group by o.id, c.phone, c.name
order by o.created_at desc;


-- =========================================
-- FEATURE: Kitchen summary — combine ALL of today's paid orders
-- into one aggregated list per item, for batch cooking.
-- Run this automatically right after each order window closes.
-- =========================================
select
  oi.item_name,
  sum(oi.quantity) as total_quantity
from order_items oi
join orders o on o.id = oi.order_id
where o.status = 'paid'
  and o.created_at::date = current_date
  and o.order_window_id = $1
group by oi.item_name
order by total_quantity desc;
