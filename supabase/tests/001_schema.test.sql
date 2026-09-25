begin;

select plan(19);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'dealers', 'dealers table exists');
select has_table('public', 'products', 'products table exists');
select has_table('public', 'app_settings', 'settings table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_lines', 'order lines table exists');

select col_type_is('public', 'products', 'price_cents', 'bigint', 'catalogue money uses bigint');
select col_type_is('public', 'orders', 'total_cents', 'bigint', 'order USD total uses bigint');
select col_type_is('public', 'orders', 'sdg_total', 'bigint', 'order SDG total uses bigint');
select col_type_is('public', 'order_lines', 'discount_cents', 'bigint', 'discount uses bigint');

select has_function('public', 'save_order_draft', array['uuid', 'integer', 'jsonb', 'uuid'], 'draft save RPC exists');
select has_function('public', 'approve_order_line', array['uuid'], 'approval RPC exists');
select has_function('public', 'finalize_order', array['uuid', 'timestamp with time zone'], 'version-checked finalization RPC exists');
select has_function('public', 'save_and_finalize_order', array['uuid', 'integer', 'jsonb', 'uuid'], 'atomic save and finalization RPC exists');
select has_function('public', 'set_current_exchange_rate', array['integer'], 'settings RPC exists');
select hasnt_trigger(
  'auth',
  'users',
  'on_auth_user_created',
  'new Auth users do not receive application access automatically'
);

select results_eq(
  $$ select minimum_exchange_rate::bigint, current_exchange_rate::bigint from public.app_settings where id = 1 $$,
  $$ values (8000::bigint, 8200::bigint) $$,
  'minimum and initial current rate are seeded'
);

select results_eq(
  $$ select name, city from public.dealers order by name $$,
  $$ values
    ('Ahmed Trading'::text, 'Khartoum'::text),
    ('Dongola Power'::text, 'Dongola'::text),
    ('Nile Solar'::text, 'Omdurman'::text)
  $$,
  'exactly the three required dealers are seeded'
);

select results_eq(
  $$ select id::text, name, price_cents, active from public.products order by id $$,
  $$ values
    ('10000000-0000-4000-8000-000000000001'::text, 'SPF 6000 ES Plus — 6 kW inverter'::text, 51500::bigint, true),
    ('10000000-0000-4000-8000-000000000002'::text, 'SPE 12000 ES — 12 kW inverter'::text, 97500::bigint, true),
    ('10000000-0000-4000-8000-000000000003'::text, 'Hope 5.0L-B1 — 5 kWh battery'::text, 81000::bigint, true),
    ('10000000-0000-4000-8000-000000000004'::text, 'Hope 16.0LM-A1 — 16 kWh battery'::text, 207000::bigint, true)
  $$,
  'exactly the four required products and prices are seeded'
);

select * from finish();
rollback;
