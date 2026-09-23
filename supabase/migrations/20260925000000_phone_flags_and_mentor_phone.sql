-- Phone numbers are informational, not a sign-up gate.
--
-- 1. Sign-up checks only the email against the roster. A phone that differs
--    from the LXP roster, or that another account already uses, is accepted
--    and flagged to admins in the 학생 tab instead of blocking the student.
-- 2. Admins can store each mentor's phone. Students never read the mentors
--    table directly (they get named columns through student_board()), and RLS
--    lets only admins and the mentor themself read the row.
--
-- Nothing is deleted: the unique index on students.phone is replaced by a
-- plain index (lookups by phone stay fast), and a column is added.

-- 1. Allow the same phone on two student accounts ----------------------------

alter table public.students drop constraint if exists students_phone_key;
drop index if exists public.students_phone_key;
create index if not exists students_phone_idx on public.students (phone);

-- 2. Mentor phone -------------------------------------------------------------

alter table public.mentors add column if not exists phone text;

-- 3. Roster with phone flags for the admin 학생 tab --------------------------
-- Return type changes, so the function is dropped and created again.

drop function if exists public.admin_student_roster();

create function public.admin_student_roster()
returns table (
  email text, name text, region_group text, region text, phone text,
  student_id bigint, status text, booking_count bigint, is_test boolean,
  roster_phone text, phone_differs boolean, phone_shared boolean
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
  ),
  -- Phone digits used by more than one student record.
  shared as (
    select regexp_replace(s.phone, '\D', '', 'g') as digits
    from public.students s
    where s.phone is not null
    group by 1
    having count(*) > 1
  )
  select w.email, w.name, w.region_group, w.region, coalesce(s.phone, w.phone), s.id,
         case
           when s.id is null then 'not_signed_up'
           when u.email_confirmed_at is null then 'pending_verification'
           else 'active'
         end,
         coalesce(c.n, 0), w.is_test,
         w.phone,
         -- Signed up with a number that is not the one in the LXP roster.
         (s.id is not null and w.phone is not null
           and regexp_replace(s.phone, '\D', '', 'g') <> regexp_replace(w.phone, '\D', '', 'g')),
         (s.id is not null and exists (select 1 from shared sh where sh.digits = regexp_replace(s.phone, '\D', '', 'g')))
  from public.whitelist_students w
  left join public.students s on s.email = w.email
  left join auth.users u on u.id = s.user_id
  left join counts c on c.student_id = s.id
  union all
  select null, s.name, s.region_group, s.region, s.phone, s.id, 'legacy', coalesce(c.n, 0), s.is_test,
         null, false,
         exists (select 1 from shared sh where sh.digits = regexp_replace(s.phone, '\D', '', 'g'))
  from public.students s
  left join counts c on c.student_id = s.id
  where s.email is null
  order by 3, 4, 2;
end;
$$;

revoke execute on function public.admin_student_roster() from public, anon, authenticated;
grant execute on function public.admin_student_roster() to authenticated;
