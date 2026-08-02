# Hungry Buds — Project Scaffold

This is the real starting codebase (not a mockup). What's here so far:

## What's built and tested
- `data/menu.json` — menu item schema, including the `veg: true/false` flag
  (renders as the standard green/red square dot on every card — no more relying
  on photos to tell dishes apart).
- `data/orderWindows.json` — the two ordering windows, editable without touching
  code. This is what the admin panel will read/write.
- `lib/orderWindow.js` — the actual open/closed logic, admin-config-driven.
- `lib/orderWindow.test.js` — 12 passing tests, including the exact edge cases
  you flagged (12:30:00 and 2:00:00 boundaries). Run with: `node lib/orderWindow.test.js`

## Design decisions baked in
- **Half-open boundary**: closes at exactly 12:30:00, not 12:30:01 — tested explicitly.
- **Everything admin-editable is data, not code**: menu items, prices, stock, time
  windows, and the closed-message text all live in JSON now, moving to a real
  database (Supabase) next — never hardcoded into the UI.

## Next steps (in order)
1. Move `menu.json` / `orderWindows.json` into a real Supabase Postgres database
2. Build the Next.js app (storefront + API routes) around this logic
3. Admin panel: password + OTP, CRUD for menu, time windows, closed-message
4. Cart → Razorpay checkout (small real-₹ test before going live)
5. Phone-based order lookup
6. Kitchen summary aggregation report
