begin;

alter table public.event_tickets
  add column generation_cycle integer not null default 0,
  add constraint event_tickets_generation_cycle_check check (generation_cycle >= 0);

alter table public.event_passes
  add column generation_cycle integer not null default 0;

alter table public.event_passes
  drop constraint event_passes_ticket_generation_key,
  add constraint event_passes_ticket_generation_key unique (
    ticket_id, generation_cycle, generation
  );

create or replace function public.assign_pass_generation_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select generation_cycle into new.generation_cycle
  from public.event_tickets
  where id = new.ticket_id;
  return new;
end;
$$;

create trigger event_passes_assign_generation_cycle
before insert on public.event_passes
for each row execute function public.assign_pass_generation_cycle();

create or replace function public.enforce_ticket_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reset_allowed boolean := coalesce(current_setting('focaccia.allow_ticket_reset', true), '') = 'on';
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status = 'claimed' and new.status in ('enrolled', 'cancelled', 'revoked'))
     or (old.status = 'enrolled' and new.status in ('checked_in', 'cancelled', 'revoked')) then
    return new;
  end if;

  if old.status = 'enrolled' and new.status = 'claimed' and reset_allowed then
    new.generation_cycle = old.generation_cycle + 1;
    return new;
  end if;

  raise exception using errcode = '23514', message = 'invalid_ticket_state_transition';
end;
$$;

commit;
