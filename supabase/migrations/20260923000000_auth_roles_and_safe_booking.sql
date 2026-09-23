-- =============================================================================
-- Auth, roles and race-safe booking
--
-- What this migration does (additive: no existing row is deleted):
--   1. regions             : single source of truth for each region's session period
--   2. whitelist_students  : the LXP roster; only these emails may sign up as students
--   3. admins              : operations team (owner + invited members)
--   4. students / mentors  : linked to auth.users, gain email + status columns
--   5. bookings            : soft cancel (cancelled_at) instead of DELETE, so history
--                            is kept and the "one booking per slot" rule only counts
--                            active rows
--   6. auth.users triggers : block sign-ups from unknown emails, link new users to
--                            their student / mentor / admin row
--   7. RLS                 : replaces the old "anyone can do anything" policies
--   8. booking functions   : every booking write goes through a function that
--                            validates the rules inside one transaction
--
-- Personal data (roster emails, mentor emails, classroom links, the owner email)
-- is NOT in this file because the repository is public. See README "Data setup".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Shared constants
-- -----------------------------------------------------------------------------

-- The four 30-minute evening slots. Order matters: "consecutive" means adjacent
-- positions in this array. Mirrors TIME_SLOTS in lib/booking/constants.js.
create or replace function public.time_slots()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['19:00', '19:30', '20:00', '20:30'] $$;

-- Current wall-clock time in Korea. Sessions are stored as a date + 'HH:MM'
-- string in KST, so every "is this in the past?" check compares against this.
create or replace function public.now_kst()
returns timestamp
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul') $$;


-- -----------------------------------------------------------------------------
-- 1. Regions
-- -----------------------------------------------------------------------------

create table public.regions (
  name        text primary key,
  areas       text[]   not null,
  starts_on   date     not null,
  ends_on     date     not null,
  sort_order  smallint not null default 0,
  constraint regions_period_check check (ends_on >= starts_on)
);

comment on table public.regions is 'Mentoring regions and their session period (weekdays only, KST).';

insert into public.regions (name, areas, starts_on, ends_on, sort_order) values
  ('충청권', array['충남', '충북', '세종'], '2026-10-13', '2026-10-30', 1),
  ('동남권', array['부산', '울산', '경남'], '2026-10-12', '2026-10-23', 2);

alter table public.mentors
  add constraint mentors_region_group_fkey foreign key (region_group) references public.regions (name);
alter table public.students
  add constraint students_region_group_fkey foreign key (region_group) references public.regions (name);


-- -----------------------------------------------------------------------------
-- 2. Student whitelist (LXP roster)
-- -----------------------------------------------------------------------------

create table public.whitelist_students (
  email         text primary key,
  name          text        not null,
  region_group  text        not null references public.regions (name),
  region        text        not null,
  phone         text,
  is_test       boolean     not null default false,
  created_at    timestamptz not null default now(),
  -- Emails are compared case-insensitively everywhere, so store them normalised.
  constraint whitelist_students_email_normalised check (email = lower(btrim(email)))
);

comment on table public.whitelist_students is 'LXP roster. Only these emails can create a student account.';
comment on column public.whitelist_students.phone is 'Optional. Reserved for when the roster includes phone numbers.';


-- -----------------------------------------------------------------------------
-- 3. Admins
-- -----------------------------------------------------------------------------

create table public.admins (
  email         text primary key,
  name          text        not null,
  is_owner      boolean     not null default false,
  user_id       uuid        unique references auth.users (id) on delete set null,
  invited_at    timestamptz,
  activated_at  timestamptz,
  is_test       boolean     not null default false,
  created_at    timestamptz not null default now(),
  constraint admins_email_normalised check (email = lower(btrim(email)))
);

-- Exactly one owner. The owner cannot be revoked (enforced in admin_revoke()).
create unique index admins_single_owner_key on public.admins (is_owner) where is_owner;

comment on table public.admins is 'Operations team. No public sign-up: rows are added by invitation.';


-- -----------------------------------------------------------------------------
-- 4. Students and mentors: link to auth accounts
-- -----------------------------------------------------------------------------

-- Existing student rows (created by the old phone-number screen) keep user_id and
-- email NULL. They are linked when someone signs up with the same phone number.
alter table public.students
  add column user_id       uuid        unique references auth.users (id) on delete set null,
  add column email         text        unique,
  add column consented_at  timestamptz,
  add column is_test       boolean     not null default false,
  add constraint students_email_normalised check (email = lower(btrim(email)));

alter table public.mentors
  add column email         text        unique,
  add column user_id       uuid        unique references auth.users (id) on delete set null,
  add column invited_at    timestamptz,
  add column activated_at  timestamptz,
  add column is_test       boolean     not null default false,
  add column updated_at    timestamptz,
  add constraint mentors_email_normalised check (email = lower(btrim(email))),
  add constraint mentors_meeting_link_http check (meeting_link is null or meeting_link ~ '^https?://');


-- -----------------------------------------------------------------------------
-- 5. Bookings: soft cancel + audit columns
-- -----------------------------------------------------------------------------

alter table public.bookings
  add column created_by    uuid        references auth.users (id) on delete set null,
  add column cancelled_at  timestamptz,
  add column cancelled_by  uuid        references auth.users (id) on delete set null;

-- The old constraint counted every row. With soft cancel, only active bookings
-- may hold a slot, so it becomes a partial unique index. This index is what
-- stops two students from booking the same slot at the same moment: the second
-- INSERT fails inside Postgres, whatever the clients believed.
alter table public.bookings drop constraint bookings_mentor_id_booking_date_booking_time_key;
create unique index bookings_active_mentor_slot_key
  on public.bookings (mentor_id, booking_date, booking_time) where cancelled_at is null;

-- A student cannot sit in two mentors' sessions at the same time.
create unique index bookings_active_student_slot_key
  on public.bookings (student_id, booking_date, booking_time) where cancelled_at is null;

create index bookings_student_id_idx on public.bookings (student_id);
create index bookings_created_by_idx on public.bookings (created_by);
create index bookings_cancelled_by_idx on public.bookings (cancelled_by);


-- -----------------------------------------------------------------------------
-- 6. Who is calling? (used by RLS and the booking functions)
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

create or replace function public.current_mentor_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select id from public.mentors where user_id = (select auth.uid()) $$;

create or replace function public.current_student_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select id from public.students where user_id = (select auth.uid()) $$;

-- Mentors a signed-in student may see on their board: same region, and test
-- students only ever see test mentors (and real students only real mentors).
create or replace function public.bookable_mentor_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.mentors m
  join public.students s on s.region_group = m.region_group and s.is_test = m.is_test
  where s.user_id = (select auth.uid())
$$;

-- Students with an active booking with the signed-in mentor.
create or replace function public.current_mentor_student_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select student_id from public.bookings
  where mentor_id = public.current_mentor_id() and cancelled_at is null
$$;

-- The role the app routes to. Admin wins over mentor over student, so an
-- operations member who is also on another list still lands on /admin.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then 'admin'
    when public.current_mentor_id() is not null then 'mentor'
    when public.current_student_id() is not null then 'student'
  end
$$;


-- -----------------------------------------------------------------------------
-- 7. auth.users triggers
-- -----------------------------------------------------------------------------

-- '01012345678' / '010 1234 5678' -> '010-1234-5678'. Other shapes are kept as digits.
create or replace function public.format_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^01[0-9]{9}$' then substr(d, 1, 3) || '-' || substr(d, 4, 4) || '-' || substr(d, 8, 4)
    when d ~ '^01[0-9]{8}$' then substr(d, 1, 3) || '-' || substr(d, 4, 3) || '-' || substr(d, 7, 4)
    else nullif(d, '')
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) as x
$$;

-- Runs BEFORE a user row is created, for every path (sign-up, invite, admin API).
-- This is the real gate: the sign-up page checks the roster too, but only to show
-- a friendly message. Someone calling the Auth API directly still hits this.
create or replace function public.guard_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(new.email));
begin
  if not exists (select 1 from public.whitelist_students where email = v_email)
     and not exists (select 1 from public.mentors where email = v_email)
     and not exists (select 1 from public.admins where email = v_email) then
    raise exception 'SIGNUP_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_new_user
  before insert on auth.users
  for each row execute function public.guard_new_user();

-- Runs AFTER the user row exists: attaches it to the matching admin, mentor or
-- student record. Students get a students row built from the roster; if an old
-- phone-number record has the same phone, that record is claimed instead so its
-- bookings follow the new account.
create or replace function public.link_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(new.email));
  v_roster  public.whitelist_students;
  v_phone   text;
  v_legacy  bigint;
begin
  update public.admins  set user_id = new.id where email = v_email and user_id is null;
  update public.mentors set user_id = new.id where email = v_email and user_id is null;

  select * into v_roster from public.whitelist_students where email = v_email;
  if not found then
    return new;
  end if;

  v_phone := coalesce(public.format_phone(new.raw_user_meta_data ->> 'phone'), public.format_phone(v_roster.phone));
  if v_phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;

  select id into v_legacy
  from public.students
  where user_id is null
    and email is null
    and regexp_replace(phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
  order by id
  limit 1;

  if v_legacy is not null then
    update public.students
    set user_id = new.id,
        email = v_email,
        name = v_roster.name,
        phone = v_phone,
        region_group = v_roster.region_group,
        region = v_roster.region,
        is_test = v_roster.is_test,
        consented_at = now()
    where id = v_legacy;
  else
    insert into public.students (name, phone, region_group, region, user_id, email, is_test, consented_at)
    values (v_roster.name, v_phone, v_roster.region_group, v_roster.region, new.id, v_email, v_roster.is_test, now());
  end if;

  return new;
end;
$$;

create trigger link_new_user
  after insert on auth.users
  for each row execute function public.link_new_user();

-- Called by the "set password" page after an invited mentor/admin picks a password.
create or replace function public.mark_activated()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admins  set activated_at = coalesce(activated_at, now()) where user_id = (select auth.uid());
  update public.mentors set activated_at = coalesce(activated_at, now()) where user_id = (select auth.uid());
$$;


-- -----------------------------------------------------------------------------
-- 8. Row level security
-- -----------------------------------------------------------------------------

-- Old policies let anonymous visitors read every phone number and insert or
-- delete any booking. They are replaced, not supplemented.
drop policy if exists "students are viewable by everyone" on public.students;
drop policy if exists "students can be created by anyone" on public.students;
drop policy if exists "students can be updated by anyone" on public.students;
drop policy if exists "bookings are viewable by everyone" on public.bookings;
drop policy if exists "bookings can be created by anyone" on public.bookings;
drop policy if exists "bookings can be deleted by anyone" on public.bookings;
drop policy if exists "mentors are viewable by everyone" on public.mentors;

alter table public.regions            enable row level security;
alter table public.whitelist_students enable row level security;
alter table public.admins             enable row level security;

-- regions: any signed-in user (needed to draw the board)
create policy "regions readable by signed-in users" on public.regions
  for select to authenticated using (true);
create policy "regions editable by admins" on public.regions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- whitelist: admins only (students never read the roster directly)
create policy "whitelist readable by admins" on public.whitelist_students
  for select to authenticated using (public.is_admin());
create policy "whitelist insertable by admins" on public.whitelist_students
  for insert to authenticated with check (public.is_admin());
create policy "whitelist updatable by admins" on public.whitelist_students
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- admins: members can see each other; changes go through server actions / functions
create policy "admins readable by admins" on public.admins
  for select to authenticated using (public.is_admin());

-- students: own row, admins, and mentors for students booked with them.
-- (Cross-table checks go through security-definer helpers; a policy on students
-- that queries bookings, whose policy queries students, would recurse.)
create policy "students read own row" on public.students
  for select to authenticated using (user_id = (select auth.uid()));
create policy "students readable by admins" on public.students
  for select to authenticated using (public.is_admin());
create policy "students readable by their mentors" on public.students
  for select to authenticated using (id in (select public.current_mentor_student_ids()));

-- mentors: own row and admins. Students get mentor details from student_board(),
-- which hides the classroom link until they have booked.
create policy "mentors read own row" on public.mentors
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mentors readable by admins" on public.mentors
  for select to authenticated using (public.is_admin());
create policy "mentors updatable by admins" on public.mentors
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings: read-only through RLS; every write goes through the functions below.
-- Students can see which slots in their own region are taken (needed for the live
-- board and realtime updates). The row carries only an internal student id, never
-- a name or phone number.
create policy "bookings readable by admins" on public.bookings
  for select to authenticated using (public.is_admin());
create policy "bookings readable by their mentor" on public.bookings
  for select to authenticated using (mentor_id = public.current_mentor_id());
create policy "bookings in own region readable by students" on public.bookings
  for select to authenticated using (mentor_id in (select public.bookable_mentor_ids()));

-- Anonymous visitors get nothing from these tables.
revoke all on public.regions, public.whitelist_students, public.admins,
              public.students, public.mentors, public.bookings from anon;


-- -----------------------------------------------------------------------------
-- 9. Booking rules
-- -----------------------------------------------------------------------------

-- Returns NULL when the slot is allowed for this student, otherwise a rule code.
-- Rules (same as the UI): max 2 slots per day, and if 2, they must be adjacent.
-- p_exclude_booking lets "move" ignore the booking being moved.
create or replace function public.slot_rule_violation(
  p_student_id bigint,
  p_date date,
  p_time text,
  p_exclude_booking bigint default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_taken  int[];
  v_target int := array_position(public.time_slots(), p_time);
begin
  select coalesce(array_agg(array_position(public.time_slots(), booking_time)), '{}')
  into v_taken
  from public.bookings
  where student_id = p_student_id
    and booking_date = p_date
    and cancelled_at is null
    and id is distinct from p_exclude_booking;

  if v_target = any (v_taken) then return 'RULE_SAME_TIME'; end if;
  if cardinality(v_taken) >= 2 then return 'RULE_DAILY_LIMIT'; end if;
  if cardinality(v_taken) = 1 and abs(v_taken[1] - v_target) <> 1 then return 'RULE_CONSECUTIVE'; end if;
  return null;
end;
$$;

-- Checks that do not depend on the student's other bookings. Raises on failure.
create or replace function public.assert_slot_bookable(
  p_student public.students,
  p_mentor_id bigint,
  p_date date,
  p_time text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mentor public.mentors;
  v_region public.regions;
begin
  select * into v_mentor from public.mentors where id = p_mentor_id;
  if not found or v_mentor.is_test <> p_student.is_test then
    raise exception 'MENTOR_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_mentor.region_group <> p_student.region_group then
    raise exception 'OUTSIDE_REGION' using errcode = 'P0001';
  end if;
  if not (p_time = any (public.time_slots())) then
    raise exception 'INVALID_TIME' using errcode = 'P0001';
  end if;

  select * into v_region from public.regions where name = v_mentor.region_group;
  if p_date < v_region.starts_on or p_date > v_region.ends_on or extract(isodow from p_date) > 5 then
    raise exception 'OUTSIDE_PERIOD' using errcode = 'P0001';
  end if;
  if (p_date + p_time::time) <= public.now_kst() then
    raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
  end if;
end;
$$;

-- Serialises all booking writes for one student. Two browser tabs submitting at
-- once would otherwise both pass the "max 2 per day" check before either insert
-- lands. Different students do not wait on each other.
create or replace function public.lock_student(p_student_id bigint)
returns void
language sql
volatile
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtext('bookings.student'), p_student_id::int) $$;

-- Inserts one booking, turning a unique-index clash into a readable error.
create or replace function public.insert_booking(
  p_student_id bigint,
  p_mentor_id bigint,
  p_date date,
  p_time text
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.bookings;
begin
  insert into public.bookings (student_id, mentor_id, booking_date, booking_time, created_by)
  values (p_student_id, p_mentor_id, p_date, p_time, (select auth.uid()))
  returning * into v_row;
  return v_row;
exception when unique_violation then
  -- Either another student took the slot a moment ago, or this student already
  -- holds a different mentor at the same time.
  if exists (select 1 from public.bookings
             where mentor_id = p_mentor_id and booking_date = p_date
               and booking_time = p_time and cancelled_at is null) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001', detail = p_date || ' ' || p_time;
  end if;
  raise exception 'RULE_SAME_TIME' using errcode = 'P0001', detail = p_date || ' ' || p_time;
end;
$$;


-- -----------------------------------------------------------------------------
-- 10. Booking API (called from the app with supabase.rpc)
-- -----------------------------------------------------------------------------

-- Student confirms the slots in their tray. All or nothing: if any slot fails,
-- none are booked and the error names the problem.
-- p_slots: [{ "mentor_id": 7, "date": "2026-10-12", "time": "19:00" }, ...]
create or replace function public.book_slots(p_slots jsonb)
returns setof public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_slot    record;
  v_rule    text;
begin
  select * into v_student from public.students where user_id = (select auth.uid());
  if not found then
    raise exception 'NOT_A_STUDENT' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'NO_SLOTS' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_slots) > 10 then
    raise exception 'TOO_MANY_SLOTS' using errcode = 'P0001';
  end if;

  perform public.lock_student(v_student.id);

  -- Sorted so a pair like 20:00 + 19:30 is checked in time order.
  for v_slot in
    select (s ->> 'mentor_id')::bigint as mentor_id, (s ->> 'date')::date as d, s ->> 'time' as t
    from jsonb_array_elements(p_slots) as s
    order by 2, 3
  loop
    perform public.assert_slot_bookable(v_student, v_slot.mentor_id, v_slot.d, v_slot.t);
    v_rule := public.slot_rule_violation(v_student.id, v_slot.d, v_slot.t);
    if v_rule is not null then
      raise exception '%', v_rule using errcode = 'P0001', detail = v_slot.d || ' ' || v_slot.t;
    end if;
    return next public.insert_booking(v_student.id, v_slot.mentor_id, v_slot.d, v_slot.t);
  end loop;
end;
$$;

-- Cancel. Students: own future bookings. Admins: any active booking.
create or replace function public.cancel_booking(p_booking_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_admin   boolean := public.is_admin();
begin
  select * into v_booking from public.bookings where id = p_booking_id and cancelled_at is null;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not v_admin then
    if v_booking.student_id is distinct from public.current_student_id() then
      raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
    end if;
    if (v_booking.booking_date + v_booking.booking_time::time) <= public.now_kst() then
      raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings
  set cancelled_at = now(), cancelled_by = (select auth.uid())
  where id = p_booking_id;
end;
$$;

-- Move a booking to another slot in one transaction (cancel old + insert new).
-- Admins may pass p_force to ignore the per-day rules, never the slot clash.
create or replace function public.move_booking(
  p_booking_id bigint,
  p_mentor_id bigint,
  p_date date,
  p_time text,
  p_force boolean default false
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_student public.students;
  v_admin   boolean := public.is_admin();
  v_rule    text;
begin
  select * into v_booking from public.bookings where id = p_booking_id and cancelled_at is null;
  if not found or (not v_admin and v_booking.student_id is distinct from public.current_student_id()) then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not v_admin and (v_booking.booking_date + v_booking.booking_time::time) <= public.now_kst() then
    raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
  end if;

  select * into v_student from public.students where id = v_booking.student_id;
  perform public.lock_student(v_student.id);
  perform public.assert_slot_bookable(v_student, p_mentor_id, p_date, p_time);

  v_rule := public.slot_rule_violation(v_student.id, p_date, p_time, p_booking_id);
  if v_rule is not null and not (v_admin and p_force) then
    raise exception '%', v_rule using errcode = 'P0001';
  end if;

  update public.bookings
  set cancelled_at = now(), cancelled_by = (select auth.uid())
  where id = p_booking_id;

  return public.insert_booking(v_student.id, p_mentor_id, p_date, p_time);
end;
$$;

-- Admin books a named student into a free slot. Rule violations raise unless
-- p_force is true (the UI asks first). Slot clashes always raise.
create or replace function public.admin_create_booking(
  p_student_id bigint,
  p_mentor_id bigint,
  p_date date,
  p_time text,
  p_force boolean default false
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_rule    text;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_student from public.students where id = p_student_id;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform public.lock_student(v_student.id);
  perform public.assert_slot_bookable(v_student, p_mentor_id, p_date, p_time);

  v_rule := public.slot_rule_violation(v_student.id, p_date, p_time);
  if v_rule is not null and not p_force then
    raise exception '%', v_rule using errcode = 'P0001';
  end if;

  return public.insert_booking(v_student.id, p_mentor_id, p_date, p_time);
end;
$$;


-- -----------------------------------------------------------------------------
-- 11. Read models
-- -----------------------------------------------------------------------------

-- Everything the student board needs in one call: the student, their region,
-- the mentors they may book (without classroom links) and which slots are taken.
create or replace function public.student_board()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select * from public.students where user_id = (select auth.uid())
  ),
  my_mentors as (
    select m.id, m.name, m.field, m.intro
    from public.mentors m, me
    where m.region_group = me.region_group and m.is_test = me.is_test
  )
  select case when not exists (select 1 from me) then null else jsonb_build_object(
    'student', (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'email', email,
                                          'region_group', region_group, 'region', region) from me),
    'region',  (select to_jsonb(r) from public.regions r, me where r.name = me.region_group),
    'mentors', coalesce((select jsonb_agg(to_jsonb(mm) order by mm.id) from my_mentors mm), '[]'),
    'taken',   coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'mentor_id', b.mentor_id, 'date', b.booking_date, 'time', b.booking_time,
        'mine', b.student_id = (select id from me)))
      from public.bookings b
      where b.cancelled_at is null and b.mentor_id in (select id from my_mentors)
    ), '[]')
  ) end
$$;

-- The student's own active bookings, with the classroom link (shown only after booking).
create or replace function public.student_bookings()
returns table (
  id bigint, mentor_id bigint, booking_date date, booking_time text,
  mentor_name text, mentor_field text, meeting_link text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.mentor_id, b.booking_date, b.booking_time, m.name, m.field, m.meeting_link
  from public.bookings b
  join public.mentors m on m.id = b.mentor_id
  where b.student_id = public.current_student_id() and b.cancelled_at is null
  order by b.booking_date, b.booking_time
$$;

-- Admin "Students" tab: roster joined with account status and booking counts.
-- Includes old phone-number records that no roster email has claimed yet.
create or replace function public.admin_student_roster()
returns table (
  email text, name text, region_group text, region text, phone text,
  student_id bigint, status text, booking_count bigint, is_test boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  with counts as (
    select b.student_id, count(*) as n
    from public.bookings b
    where b.cancelled_at is null
    group by b.student_id
  )
  select w.email, w.name, w.region_group, w.region, coalesce(s.phone, w.phone), s.id,
         case
           when s.id is null then 'not_signed_up'
           when u.email_confirmed_at is null then 'pending_verification'
           else 'active'
         end,
         coalesce(c.n, 0), w.is_test
  from public.whitelist_students w
  left join public.students s on s.email = w.email
  left join auth.users u on u.id = s.user_id
  left join counts c on c.student_id = s.id
  union all
  select null, s.name, s.region_group, s.region, s.phone, s.id, 'legacy', coalesce(c.n, 0), s.is_test
  from public.students s
  left join counts c on c.student_id = s.id
  where s.email is null
  order by 3, 4, 2;
end;
$$;

-- Revoke an admin. The owner and yourself cannot be revoked.
create or replace function public.admin_revoke(p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target public.admins;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_target from public.admins where email = lower(btrim(p_email));
  if not found then
    raise exception 'ADMIN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.is_owner then
    raise exception 'CANNOT_REVOKE_OWNER' using errcode = 'P0001';
  end if;
  if v_target.user_id = (select auth.uid()) then
    raise exception 'CANNOT_REVOKE_SELF' using errcode = 'P0001';
  end if;
  delete from public.admins where email = v_target.email;
end;
$$;


-- -----------------------------------------------------------------------------
-- 12. Function privileges
-- -----------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC, and Supabase also grants it to anon and
-- authenticated. Lock everything down, then open only the entry points the app
-- calls as a signed-in user. Internal helpers (insert_booking, lock_student,
-- slot_rule_violation, ...) stay private so nobody can skip the rule checks.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.app_role(),
  public.mark_activated(),
  public.book_slots(jsonb),
  public.cancel_booking(bigint),
  public.move_booking(bigint, bigint, date, text, boolean),
  public.admin_create_booking(bigint, bigint, date, text, boolean),
  public.student_board(),
  public.student_bookings(),
  public.admin_student_roster(),
  public.admin_revoke(text),
  -- used inside RLS policies, so the caller's role must be able to run them
  public.is_admin(),
  public.current_mentor_id(),
  public.current_student_id(),
  public.bookable_mentor_ids(),
  public.current_mentor_student_ids()
to authenticated;

-- The auth triggers run as supabase_auth_admin.
grant execute on function public.guard_new_user(), public.link_new_user(), public.format_phone(text)
to supabase_auth_admin;
