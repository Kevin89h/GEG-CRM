-- RPC to create an account in geg_singapore (bypasses PostgREST schema restriction)
create or replace function public.insert_singapore_account(
  p_name        text,
  p_type        text      default 'enterprise',
  p_industry    text      default null,
  p_country     text      default null,
  p_city        text      default null,
  p_phone       text      default null,
  p_email       text      default null,
  p_website     text      default null,
  p_notes       text      default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  -- reuse existing account if email matches
  if p_email is not null and p_email <> '' then
    select id into v_account_id
    from geg_singapore.accounts
    where lower(email) = lower(p_email)
    limit 1;
  end if;

  if v_account_id is null then
    insert into geg_singapore.accounts (name, type, industry, country, city, phone, email, website, notes)
    values (p_name, p_type, p_industry, p_country, p_city, p_phone, p_email, p_website, p_notes)
    returning id into v_account_id;
  end if;

  return json_build_object('id', v_account_id);
end;
$$;
