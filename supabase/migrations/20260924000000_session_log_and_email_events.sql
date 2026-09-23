-- =============================================================================
-- Session log + email send log
--
--   1. bookings.session_status : after a session starts, its mentor (or an admin)
--                                records what happened: completed, cancelled or
--                                rescheduled. A record only; it never frees or
--                                moves the slot.
--   2. email_events            : one row per email the app sends (sign-up code,
--                                invitation, password reset). Used to rate-limit
--                                sending and as an audit trail. Server-only.
-- Additive: no existing row is changed or deleted.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Session log
-- -----------------------------------------------------------------------------

alter table public.bookings
  add column session_status    text,
  add column session_logged_at timestamptz,
  add column session_logged_by uuid references auth.users (id) on delete set null,
  add constraint bookings_session_status_check
    check (session_status in ('completed', 'cancelled', 'rescheduled'));

create index bookings_session_logged_by_idx on public.bookings (session_logged_by);

-- Record (or clear, with NULL) the outcome of a session that has started.
-- Allowed for the booking's mentor and for admins.
create or replace function public.log_session(p_booking_id bigint, p_status text)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id and cancelled_at is null;
  if not found
     or not (public.is_admin() or v_booking.mentor_id = public.current_mentor_id()) then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_status is not null and p_status not in ('completed', 'cancelled', 'rescheduled') then
    raise exception 'INVALID_SESSION_STATUS' using errcode = 'P0001';
  end if;
  if (v_booking.booking_date + v_booking.booking_time::time) > public.now_kst() then
    raise exception 'SESSION_NOT_STARTED' using errcode = 'P0001';
  end if;

  update public.bookings
  set session_status = p_status,
      session_logged_at = case when p_status is null then null else now() end,
      session_logged_by = case when p_status is null then null else (select auth.uid()) end
  where id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

revoke execute on function public.log_session(bigint, text) from public, anon, authenticated;
grant execute on function public.log_session(bigint, text) to authenticated;

-- Students see the outcome of their past sessions in "내 예약".
-- (Return type changes, so the function is dropped and recreated.)
drop function public.student_bookings();
create function public.student_bookings()
returns table (
  id bigint, mentor_id bigint, booking_date date, booking_time text,
  mentor_name text, mentor_field text, meeting_link text, session_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.mentor_id, b.booking_date, b.booking_time, m.name, m.field, m.meeting_link, b.session_status
  from public.bookings b
  join public.mentors m on m.id = b.mentor_id
  where b.student_id = public.current_student_id() and b.cancelled_at is null
  order by b.booking_date, b.booking_time
$$;

revoke execute on function public.student_bookings() from public, anon, authenticated;
grant execute on function public.student_bookings() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Email send log
-- -----------------------------------------------------------------------------

create table public.email_events (
  id          bigint generated always as identity primary key,
  email       text        not null,
  kind        text        not null,
  created_at  timestamptz not null default now(),
  constraint email_events_kind_check check (kind in ('signup_code', 'invite', 'password_reset'))
);

create index email_events_email_created_idx on public.email_events (email, created_at desc);
create index email_events_created_idx on public.email_events (created_at);

comment on table public.email_events is
  'Emails sent by the app (lib/email). Written by the server with the service-role key only; used for rate limiting.';

-- RLS on with no policies: signed-in users and anonymous visitors cannot read
-- or write it. The service role bypasses RLS.
alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated;
