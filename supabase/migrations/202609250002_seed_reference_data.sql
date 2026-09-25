insert into public.dealers (id, name, city) values
  ('00000000-0000-4000-8000-000000000001', 'Ahmed Trading', 'Khartoum'),
  ('00000000-0000-4000-8000-000000000002', 'Nile Solar', 'Omdurman'),
  ('00000000-0000-4000-8000-000000000003', 'Dongola Power', 'Dongola')
on conflict (id) do update set name = excluded.name, city = excluded.city;

insert into public.products (id, name, price_cents, active) values
  ('10000000-0000-4000-8000-000000000001', 'SPF 6000 ES Plus — 6 kW inverter', 51500, true),
  ('10000000-0000-4000-8000-000000000002', 'SPE 12000 ES — 12 kW inverter', 97500, true),
  ('10000000-0000-4000-8000-000000000003', 'Hope 5.0L-B1 — 5 kWh battery', 81000, true),
  ('10000000-0000-4000-8000-000000000004', 'Hope 16.0LM-A1 — 16 kWh battery', 207000, true)
on conflict (id) do update
set name = excluded.name, price_cents = excluded.price_cents, active = excluded.active;

insert into public.app_settings (
  id,
  minimum_exchange_rate,
  current_exchange_rate
) values (1, 8000, 8200)
on conflict (id) do update
set minimum_exchange_rate = excluded.minimum_exchange_rate,
    current_exchange_rate = excluded.current_exchange_rate;

