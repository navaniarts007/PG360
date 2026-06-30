-- ---------------------------------------------------------------------------
-- 0027 — record security deposit + joining fee as first-class payment line
-- items, so a single recorded payment can collect rent + deposit + admission
-- fee together and the bill/receipt shows the full breakdown.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists security_deposit int not null default 0,
  add column if not exists joining_fee       int not null default 0;

-- Fold the two new line items into the derived total.
create or replace function public.derive_payment_status()
returns trigger language plpgsql as $$
begin
  new.total_amount := coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                    + coalesce(new.food_charge,0) + coalesce(new.other_charges,0)
                    + coalesce(new.security_deposit,0) + coalesce(new.joining_fee,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    new.status := 'paid';
  elsif new.amount_paid > 0 then
    new.status := 'partial';
  else
    new.status := 'due';
  end if;
  return new;
end;
$$;
