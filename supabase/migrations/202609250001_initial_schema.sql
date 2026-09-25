create extension if not exists pgcrypto;

create type public.app_role as enum ('adviser', 'owner');
create type public.order_status as enum ('draft', 'pending_approval', 'confirmed');
create type public.line_approval_status as enum ('not_required', 'pending', 'approved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'adviser',
  created_at timestamptz not null default now()
);

create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_cents bigint not null check (price_cents >= 0 and price_cents <= 900000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  minimum_exchange_rate integer not null default 8000
    check (minimum_exchange_rate >= 8000 and minimum_exchange_rate <= 100000),
  current_exchange_rate integer not null default 8200
    check (current_exchange_rate >= minimum_exchange_rate and current_exchange_rate <= 100000),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete restrict,
  adviser_id uuid not null references public.profiles(id) on delete restrict,
  exchange_rate integer not null check (exchange_rate >= 8000 and exchange_rate <= 100000),
  status public.order_status not null default 'draft',
  subtotal_cents bigint not null default 0 check (subtotal_cents between 0 and 9000000000000),
  discount_cents bigint not null default 0 check (discount_cents between 0 and 9000000000000),
  total_cents bigint not null default 0 check (total_cents between 0 and 9000000000000),
  sdg_total bigint not null default 0 check (sdg_total between 0 and 9000000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint orders_amounts_consistent check (
    total_cents = subtotal_cents - discount_cents
    and sdg_total = ((total_cents * exchange_rate + 50) / 100)
  ),
  constraint orders_confirmation_consistent check (
    (status = 'confirmed' and confirmed_at is not null)
    or (status <> 'confirmed' and confirmed_at is null)
  )
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_position smallint not null check (line_position between 1 and 100),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0 and quantity <= 10000),
  unit_price_cents bigint not null check (unit_price_cents >= 0 and unit_price_cents <= 900000000),
  line_value_cents bigint generated always as (unit_price_cents * quantity) stored,
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  line_total_cents bigint generated always as ((unit_price_cents * quantity) - discount_cents) stored,
  approval_status public.line_approval_status not null default 'not_required',
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_lines_one_product_per_order unique (order_id, product_id),
  constraint order_lines_one_position_per_order unique (order_id, line_position),
  constraint order_lines_discount_within_value check (
    discount_cents <= unit_price_cents * quantity
  ),
  constraint order_lines_approval_threshold check (
    (
      discount_cents * 100 <= (unit_price_cents * quantity) * 5
      and approval_status = 'not_required'
    )
    or (
      discount_cents * 100 > (unit_price_cents * quantity) * 5
      and approval_status in ('pending', 'approved')
    )
  ),
  constraint order_lines_approval_metadata check (
    (
      approval_status = 'approved'
      and approved_by is not null
      and approved_at is not null
    )
    or (
      approval_status <> 'approved'
      and approved_by is null
      and approved_at is null
    )
  )
);

create index orders_adviser_created_idx
  on public.orders (adviser_id, created_at desc);
create index orders_status_created_idx
  on public.orders (status, created_at desc);
create index order_lines_order_idx on public.order_lines (order_id);
create index order_lines_pending_idx
  on public.order_lines (approval_status)
  where approval_status = 'pending';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

create trigger settings_touch_updated_at
before update on public.app_settings
for each row execute function public.touch_updated_at();

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@invalid.local'),
    'adviser'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.prevent_confirmed_order_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed' then
    raise exception using
      errcode = '55000',
      message = 'Confirmed orders are immutable.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger orders_prevent_confirmed_mutation
before update or delete on public.orders
for each row execute function public.prevent_confirmed_order_mutation();

create or replace function public.prevent_confirmed_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_order_id uuid;
  target_status public.order_status;
begin
  if tg_op = 'UPDATE' and new.order_id <> old.order_id then
    raise exception using
      errcode = '55000',
      message = 'Order lines cannot be moved between orders.';
  end if;

  if tg_op = 'INSERT' then
    target_order_id := new.order_id;
  else
    target_order_id := old.order_id;
  end if;

  select status into target_status
  from public.orders
  where id = target_order_id
  for update;

  if target_status = 'confirmed' then
    raise exception using
      errcode = '55000',
      message = 'Confirmed order lines are immutable.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger order_lines_prevent_confirmed_mutation
before insert or update or delete on public.order_lines
for each row execute function public.prevent_confirmed_line_mutation();

alter table public.profiles enable row level security;
alter table public.dealers enable row level security;
alter table public.products enable row level security;
alter table public.app_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

create policy profiles_read_self_or_owner
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_app_role() = 'owner');

create policy dealers_read_authenticated
on public.dealers for select to authenticated
using (true);

create policy products_read_authenticated
on public.products for select to authenticated
using (true);

create policy settings_read_authenticated
on public.app_settings for select to authenticated
using (true);

create policy orders_read_own_or_owner
on public.orders for select to authenticated
using (adviser_id = auth.uid() or public.current_app_role() = 'owner');

create policy order_lines_read_through_order
on public.order_lines for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_lines.order_id
      and (
        orders.adviser_id = auth.uid()
        or public.current_app_role() = 'owner'
      )
  )
);

revoke all on table public.profiles, public.dealers, public.products,
  public.app_settings, public.orders, public.order_lines from anon, authenticated;
grant select on public.profiles, public.dealers, public.products, public.app_settings,
  public.orders, public.order_lines to authenticated;

-- Local/CI provisioning is the only application tooling that uses service_role.
-- New hosted projects may not add public-schema privileges automatically.
grant usage on schema public to service_role;
grant usage on type public.app_role to service_role;
grant select, insert, update on public.profiles to service_role;
grant select, update on public.products, public.app_settings, public.orders to service_role;

create or replace function public.save_order_draft(
  p_dealer_id uuid,
  p_exchange_rate integer,
  p_lines jsonb,
  p_order_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.app_role;
  target_order public.orders%rowtype;
  target_order_id uuid;
  line jsonb;
  product_id_value uuid;
  quantity_value integer;
  discount_value bigint;
  product_price bigint;
  line_value bigint;
  subtotal_value bigint;
  discount_total bigint;
  order_total bigint;
  has_pending boolean;
  minimum_rate integer;
  existing_prices jsonb := '{}'::jsonb;
  line_position_value integer := 0;
  expected_product_updated_at timestamptz;
  current_product_updated_at timestamptz;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select role into caller_role from public.profiles where id = caller_id;
  if caller_role is null then
    raise exception using errcode = '42501', message = 'A user profile is required.';
  end if;

  select minimum_exchange_rate into minimum_rate
  from public.app_settings where id = 1;
  if minimum_rate is null then
    raise exception using errcode = '55000', message = 'Application settings are missing.';
  end if;
  if p_exchange_rate < minimum_rate or p_exchange_rate > 100000 then
    raise exception using
      errcode = '22023',
      message = format('Exchange rate must be between %s and 100000 SDG/USD.', minimum_rate);
  end if;

  if not exists (select 1 from public.dealers where id = p_dealer_id) then
    raise exception using errcode = '23503', message = 'Dealer was not found.';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) < 1
    or jsonb_array_length(p_lines) > 100 then
    raise exception using errcode = '22023', message = 'An order must contain between 1 and 100 lines.';
  end if;

  if p_order_id is null then
    insert into public.orders (dealer_id, adviser_id, exchange_rate)
    values (p_dealer_id, caller_id, p_exchange_rate)
    returning id into target_order_id;
  else
    select * into target_order
    from public.orders
    where id = p_order_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'Order was not found.';
    end if;
    if target_order.adviser_id <> caller_id and caller_role <> 'owner' then
      raise exception using errcode = '42501', message = 'You cannot edit this order.';
    end if;
    if target_order.status = 'confirmed' then
      raise exception using errcode = '55000', message = 'Confirmed orders cannot be edited.';
    end if;

    target_order_id := target_order.id;
    select coalesce(
      jsonb_object_agg(product_id::text, unit_price_cents),
      '{}'::jsonb
    ) into existing_prices
    from public.order_lines
    where order_id = target_order_id;

    delete from public.order_lines where order_id = target_order_id;
    update public.orders
    set dealer_id = p_dealer_id,
        exchange_rate = p_exchange_rate,
        status = 'draft',
        subtotal_cents = 0,
        discount_cents = 0,
        total_cents = 0,
        sdg_total = 0,
        confirmed_at = null
    where id = target_order_id;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(line) <> 'object'
      or not (
        line ? 'productId'
        and line ? 'quantity'
        and line ? 'discountCents'
        and line ? 'catalogUpdatedAt'
      )
      or exists (
        select 1 from jsonb_object_keys(line) as key
        where key not in ('productId', 'quantity', 'discountCents', 'catalogUpdatedAt')
      ) then
      raise exception using errcode = '22023', message = 'Order line input is invalid.';
    end if;

    begin
      product_id_value := (line ->> 'productId')::uuid;
      quantity_value := (line ->> 'quantity')::integer;
      discount_value := (line ->> 'discountCents')::bigint;
      expected_product_updated_at := (line ->> 'catalogUpdatedAt')::timestamptz;
    exception when others then
      raise exception using errcode = '22023', message = 'Order line values must be valid integers and identifiers.';
    end;

    if product_id_value is null
      or quantity_value is null
      or discount_value is null
      or expected_product_updated_at is null then
      raise exception using errcode = '22023', message = 'Order line values cannot be null.';
    end if;
    if quantity_value < 1 or quantity_value > 10000 then
      raise exception using errcode = '22023', message = 'Quantity must be between 1 and 10,000.';
    end if;
    if discount_value < 0 then
      raise exception using errcode = '22023', message = 'Discount cannot be negative.';
    end if;

    if existing_prices ? product_id_value::text then
      product_price := (existing_prices ->> product_id_value::text)::bigint;
    else
      select price_cents, updated_at
      into product_price, current_product_updated_at
      from public.products
      where id = product_id_value and active = true;
      if not found then
        raise exception using errcode = '23503', message = 'An active product was not found.';
      end if;
      if current_product_updated_at <> expected_product_updated_at then
        raise exception using
          errcode = '40001',
          message = 'Product price changed while the order was being edited. Please review.';
      end if;
    end if;

    line_value := product_price * quantity_value;
    if discount_value > line_value then
      raise exception using errcode = '22023', message = 'Discount cannot exceed the line value.';
    end if;

    begin
      line_position_value := line_position_value + 1;
      insert into public.order_lines (
        order_id,
        line_position,
        product_id,
        quantity,
        unit_price_cents,
        discount_cents,
        approval_status
      ) values (
        target_order_id,
        line_position_value,
        product_id_value,
        quantity_value,
        product_price,
        discount_value,
        case
          when discount_value * 100 > line_value * 5 then 'pending'::public.line_approval_status
          else 'not_required'::public.line_approval_status
        end
      );
    exception when unique_violation then
      raise exception using errcode = '23505', message = 'Each product may appear only once per order.';
    end;
  end loop;

  select
    coalesce(sum(line_value_cents), 0),
    coalesce(sum(discount_cents), 0),
    bool_or(approval_status = 'pending')
  into subtotal_value, discount_total, has_pending
  from public.order_lines
  where order_id = target_order_id;

  order_total := subtotal_value - discount_total;
  if subtotal_value > 9000000000000 or order_total > 9000000000000 then
    raise exception using errcode = '22003', message = 'Order total is outside the supported range.';
  end if;

  update public.orders
  set subtotal_cents = subtotal_value,
      discount_cents = discount_total,
      total_cents = order_total,
      sdg_total = ((order_total * p_exchange_rate + 50) / 100),
      status = case
        when has_pending then 'pending_approval'::public.order_status
        else 'draft'::public.order_status
      end
  where id = target_order_id;

  return target_order_id;
end;
$$;

create or replace function public.approve_order_line(p_line_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_order_id uuid;
  target_order public.orders%rowtype;
  target_line public.order_lines%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from public.profiles where id = caller_id and role = 'owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have permission to approve this discount.';
  end if;

  select order_id into target_order_id
  from public.order_lines where id = p_line_id;
  if target_order_id is null then
    raise exception using errcode = 'P0002', message = 'Order line was not found.';
  end if;

  select * into target_order
  from public.orders where id = target_order_id for update;
  select * into target_line
  from public.order_lines where id = p_line_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order line was not found.';
  end if;

  if target_order.status = 'confirmed' then
    raise exception using errcode = '55000', message = 'Confirmed orders cannot be changed.';
  end if;
  if target_line.discount_cents * 100 <= target_line.line_value_cents * 5 then
    raise exception using errcode = '22023', message = 'This line does not require owner approval.';
  end if;

  if target_line.approval_status <> 'approved' then
    update public.order_lines
    set approval_status = 'approved', approved_by = caller_id, approved_at = now()
    where id = p_line_id;
  end if;

  update public.orders
  set status = case
    when exists (
      select 1 from public.order_lines
      where order_id = target_order_id and approval_status = 'pending'
    ) then 'pending_approval'::public.order_status
    else 'draft'::public.order_status
  end
  where id = target_order_id;

  return p_line_id;
end;
$$;

create or replace function public.finalize_order(
  p_order_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.app_role;
  target_order public.orders%rowtype;
  subtotal_value bigint;
  discount_total bigint;
  order_total bigint;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  select role into caller_role from public.profiles where id = caller_id;

  select * into target_order
  from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order was not found.';
  end if;
  if target_order.adviser_id <> caller_id and caller_role <> 'owner' then
    raise exception using errcode = '42501', message = 'You cannot finalize this order.';
  end if;
  if p_expected_updated_at is null or target_order.updated_at <> p_expected_updated_at then
    raise exception using
      errcode = '40001',
      message = 'Order changed while it was being reviewed. Please review the latest values.';
  end if;
  if target_order.status = 'confirmed' then
    return target_order.id;
  end if;

  perform id from public.order_lines
  where order_id = p_order_id order by id for update;

  if not exists (select 1 from public.order_lines where order_id = p_order_id) then
    raise exception using errcode = '22023', message = 'An order must contain at least one line.';
  end if;
  if exists (
    select 1 from public.order_lines
    where order_id = p_order_id
      and discount_cents * 100 > line_value_cents * 5
      and approval_status <> 'approved'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Owner approval is required for discounts above 5%.';
  end if;

  select sum(line_value_cents), sum(discount_cents)
  into subtotal_value, discount_total
  from public.order_lines where order_id = p_order_id;
  order_total := subtotal_value - discount_total;
  if subtotal_value > 9000000000000 or order_total > 9000000000000 then
    raise exception using errcode = '22003', message = 'Order total is outside the supported range.';
  end if;

  update public.orders
  set subtotal_cents = subtotal_value,
      discount_cents = discount_total,
      total_cents = order_total,
      sdg_total = ((order_total * exchange_rate + 50) / 100),
      status = 'confirmed',
      confirmed_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

create or replace function public.save_and_finalize_order(
  p_dealer_id uuid,
  p_exchange_rate integer,
  p_lines jsonb,
  p_order_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order_id uuid;
  expected_updated_at timestamptz;
begin
  target_order_id := public.save_order_draft(
    p_dealer_id,
    p_exchange_rate,
    p_lines,
    p_order_id
  );
  select updated_at into expected_updated_at
  from public.orders
  where id = target_order_id;
  perform public.finalize_order(target_order_id, expected_updated_at);
  return target_order_id;
end;
$$;

create or replace function public.set_current_exchange_rate(p_exchange_rate integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  minimum_rate integer;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  if not exists (
    select 1 from public.profiles where id = caller_id and role = 'owner'
  ) then
    raise exception using errcode = '42501', message = 'Only an owner can update settings.';
  end if;

  select minimum_exchange_rate into minimum_rate
  from public.app_settings where id = 1 for update;
  if p_exchange_rate < minimum_rate or p_exchange_rate > 100000 then
    raise exception using
      errcode = '22023',
      message = format('Exchange rate must be between %s and 100000 SDG/USD.', minimum_rate);
  end if;

  update public.app_settings
  set current_exchange_rate = p_exchange_rate
  where id = 1;
  return p_exchange_rate;
end;
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;
revoke all on function public.save_order_draft(uuid, integer, jsonb, uuid) from public, anon;
grant execute on function public.save_order_draft(uuid, integer, jsonb, uuid) to authenticated;
revoke all on function public.approve_order_line(uuid) from public, anon;
grant execute on function public.approve_order_line(uuid) to authenticated;
revoke all on function public.finalize_order(uuid, timestamptz) from public, anon;
grant execute on function public.finalize_order(uuid, timestamptz) to authenticated;
revoke all on function public.save_and_finalize_order(uuid, integer, jsonb, uuid) from public, anon;
grant execute on function public.save_and_finalize_order(uuid, integer, jsonb, uuid) to authenticated;
revoke all on function public.set_current_exchange_rate(integer) from public, anon;
grant execute on function public.set_current_exchange_rate(integer) to authenticated;
