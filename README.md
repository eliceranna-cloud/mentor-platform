# 멘토링 예약 (mentor-platform)

Booking site for the ICT regional mentoring programme. Students book 30-minute evening slots with mentors in their own region, mentors see who booked them and record how each session went, and the operations team manages everything from one dashboard.

Stack: Next.js 16 (App Router, JavaScript), Supabase (Postgres, Auth, Realtime), Tailwind CSS 4, lucide-react icons, nodemailer (SMTP).

## How it works

Everyone signs in on the same page (`/login`). The account decides the destination:

| Role | How the account is created | Lands on | Can do |
| --- | --- | --- | --- |
| Student | Signs up with an email that is on the LXP roster, then enters the one-time code sent by email on `/signup/verify` (opened automatically after sign-up, and linked from the code email, the sign-up page and the login page) | `/student` | Book slots with mentors in their own region, see the live classroom link after booking, move or cancel future bookings, see the recorded outcome of past sessions |
| Mentor | An admin fills in the mentor's email and sends an invitation; the mentor sets a password | `/mentor` | See their schedule (calendar or list), each student's name, phone and area, their own classroom link, and record each session as 완료 / 취소 / 일정 변경 once it has started |
| Admin | Invited by another admin; the owner row is created during setup | `/admin` | Booking board with names, move / cancel / assign bookings (rules can be overridden after a warning), roster, mentor details and invitations, team members, session outcomes |

Anyone can use "비밀번호 찾기" to get a reset link. Invited mentors and admins who lost their invitation can use it too. Changing a password always goes through "비밀번호 찾기" (there is no separate change-password screen), so every change is confirmed through the account's own inbox. The set-password page only accepts a session that came from an email link in the last 15 minutes (checked from the `amr` claim in Supabase's signed token), so a device left signed in cannot be used to change the password. Unknown URLs show a 404 page.

Sign-up form: every field is required and checked as the student types. The email is checked against the roster a moment after typing stops ("LXP에 등록된 이메일과 일치하지 않아요" or "LXP 수강생 명단에서 확인됐어요"), the password shows a live checklist (8자 이상 · 영문 포함 · 숫자 포함), and "인증 코드 받기" stays disabled until everything is valid and consent is ticked. Tapping the disabled button shows every remaining message and moves to the first field to fix. The code length (currently 8 digits) and how long it stays valid (Supabase default 1 hour) are Supabase settings (Authentication > Providers > Email). Each code belongs to one email: several students signing up at once each get their own code, another person's code is rejected, a code works once, and "코드 다시 받기" replaces the previous code.

Only the email is checked against the roster. The phone number is not a gate: a number that differs from the LXP roster, or that another record also uses, is accepted and flagged in the admin 학생 tab ("LXP 번호와 다름", "같은 번호 있음", with the roster number shown).

Booking rules (KST, weekdays only, 19:00 to 21:00 in 30-minute slots):

- A student may book at most 2 slots per day, and 2 slots on the same day must be next to each other (one hour).
- A student cannot hold two mentors at the same time.
- Slots that have started cannot be booked, moved or cancelled by students.
- Session periods: 동남권 10/12 to 10/23, 충청권 10/13 to 10/30 (table `regions`).

Session log: after a slot's start time, its mentor (or an admin) records 완료, 취소 or 일정 변경 (`bookings.session_status`, via `public.log_session`). It is a record only; it never frees or moves the slot. The mentor page shows a reminder while sessions are unrecorded.

## Why double-booking cannot happen

Caching would not prevent two students taking the same slot; it would only make the board staler. The protection lives in the database:

1. **Unique index** `bookings_active_mentor_slot_key` on (mentor, date, time) for active bookings. When two students press "예약 확정" at the same moment, Postgres accepts the first insert and rejects the second; the second student sees "방금 다른 학생이 먼저 예약한 시간이 있어요" and the board refreshes.
2. **One transaction per request.** `book_slots()` validates and inserts all selected slots together; if any slot fails, none are booked.
3. **Per-student lock.** `pg_advisory_xact_lock` serialises one student's requests, so two browser tabs cannot both pass the "2 per day" check.
4. **No direct writes.** Row Level Security blocks inserts, updates and deletes on `bookings`; every change goes through `book_slots`, `move_booking`, `cancel_booking`, `admin_create_booking` or `log_session`, which enforce the rules.
5. **Live board.** Supabase Realtime pushes booking changes, so the board updates without a refresh.

Tested against the live database: five identical requests at once produced exactly one booking, and two simultaneous non-adjacent requests produced exactly one success. Cancelled bookings are kept (`cancelled_at`, `cancelled_by`) as an audit trail.

## Passwords

Passwords are handled only by Supabase Auth, which stores a bcrypt hash (never the password) in `auth.users.encrypted_password`. That is why `students`, `mentors` and `admins` have no password column: they are profile tables linked to `auth.users` by `user_id`, and a password (or hash) must never be copied into a `public` table, where the API could expose it. To see who has set a password: Supabase > Authentication > Users (the dashboard never shows the hash), or in the SQL editor `select email, left(encrypted_password, 7) from auth.users` (`$2a$10$` = bcrypt, empty = invited but no password yet). The app passes passwords straight to Supabase and never stores or logs them. The test-account script uses the Auth admin API, so its passwords are bcrypt-hashed by Supabase as well.

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in every value. Add the same values to the hosting environment.

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page, `anon` key | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, `service_role` key | **Required.** Secret. Roster check at sign-up, creating codes and links, invitations |
| `SITE_URL` | Public address of the deployed site | Used in invitation and reset links. Read at runtime (change it without rebuilding). Not needed for `npm run dev`; optional on Netlify. `NEXT_PUBLIC_SITE_URL` still works as a fallback |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Brevo > Settings > SMTP & API > SMTP | See Email below |
| `EMAIL_FROM` | A sender verified in Brevo (Senders list) | e.g. `"멘토링 예약 <you@elicer.com>"`. Must be on the Brevo Senders list |
| `TEST_ACCOUNT_PASSWORD` | Optional | Demo password for the test student and mentor |
| `EMAIL_HOURLY_LIMIT` | Optional | Max emails per rolling hour for the whole app. Default 50. Raise it (e.g. 150) for launch day, keeping the Brevo free plan's 300/day in mind |

If the service-role key is not visible to you in Supabase (only some roles can see it), ask the project owner for it.

Links in emails (`lib/site-url.js`):

| Where the app runs | Links point to | What to set |
| --- | --- | --- |
| `npm run dev` | The address you opened (`http://localhost:3000`, or your PC's LAN address when testing from a phone) | Nothing |
| Netlify | `SITE_URL` if set, else Netlify's own site address (`URL`; deploy previews use their preview address) | Nothing, or `SITE_URL` once a custom domain is attached |
| EC2 or any other server | `SITE_URL` | `SITE_URL=https://your-domain` in the server's environment (systemd, pm2 or Docker env) |

In production the request's Host header is never used for links, because a forged header could otherwise put another domain into a password-reset email.

### 2. Email (no Supabase dashboard access needed)

The app sends its own emails. Supabase only generates the sign-up codes and one-time links (`auth.admin.generateLink`, which sends nothing), and the app delivers them over SMTP (`lib/email`). So Supabase's SMTP settings, email templates and email rate limits are not used and do not need changing.

Templates (`lib/email/templates.js`): the Elice logo is embedded in each email as an inline image (`lib/email/logo.js`, a 288px copy of `public/elice-logo.png`), so it shows even when links point to localhost. Email clients cannot run scripts, so there is no real "copy" button; the code is in the subject and in one plain block of digits, which lets Gmail show its own "코드 복사" chip and iPhone/Mac offer it as AutoFill. To change the logo, replace `public/elice-logo.png` and regenerate `logo.js` with sharp (resize to 288px wide, base64).

Limits built into the app (`lib/email/quota.js`): one email of the same kind per address per minute, and at most `EMAIL_HOURLY_LIMIT` emails per hour overall. Every send is recorded in `public.email_events` (server-only table).

Brevo setup (free plan: 300 emails/day):

1. Create an account at [brevo.com](https://www.brevo.com/free-smtp-server/) (no card needed).
2. **Senders, domains & dedicated IPs > Senders > Add a sender.** Use the address mail should come from and confirm it from the email Brevo sends.
   - For production, use an address on a domain Elice controls (e.g. `no-reply@elicer.io`) and, under **Domains**, add the domain and give the DKIM / DMARC records Brevo shows to whoever manages Elice's DNS. Without an authenticated domain, Brevo still delivers but rewrites the sender to `@brevosend.com`.
   - Without DNS access, add your own work or Gmail address as a sender and click the confirmation link Brevo emails you. No DNS change is needed; mail may land in spam more often until a domain is authenticated.
3. **Settings > SMTP & API > SMTP tab.** Note the server (`smtp-relay.brevo.com`), port (`587`) and login, then **Generate a new SMTP key**. The key is shown once.
4. Put these in `.env`: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER=<login>`, `SMTP_PASS=<SMTP key>`, `EMAIL_FROM="멘토링 예약 <your verified sender>"`.
5. Restart the app and use "비밀번호 찾기" with the test student email to check delivery.

Supabase settings the owner can change later (optional): keep **Confirm email** on (Authentication > Providers > Email), set **Site URL** to the production address, and turn on **Leaked password protection**.

### 3. Database

The schema is in `supabase/migrations/`. All files have been applied to the linked project. For a new project, run them with the Supabase CLI (`supabase db push`) or paste them into the SQL editor in order.

Personal data is **not** in this repository, because it is public: the roster, mentor emails, classroom links and the owner email were loaded directly into the database. For a fresh database:

```sql
insert into public.admins (email, name, is_owner) values ('owner@example.com', 'Owner name', true);
```

Then import the roster (see below) and fill mentor details in the admin Mentors tab.

### 4. Owner and mentor invitations

1. Sign in with the test admin account and open 멤버. Press "초대 메일 보내기" on the owner row. The owner receives the invitation and sets a password.
2. Open 멘토, press "정보 수정" for each mentor, enter their email (and change the classroom link if needed), then press "초대 메일 보내기".

## Roster (student whitelist)

Only emails in `whitelist_students` can create a student account; name, region (권역) and local area (지역) come from the roster. Rejected students are told to contact the office. Admins can then add them in the 학생 tab ("명단에 추가").

Staff who want to try the student side: add their personal email to the roster with `is_test = true` (currently 3 staff emails, 동남권 · 울산). They then only see the hidden 테스트 멘토 and are hidden from admin lists unless "테스트 계정 포함" is ticked. Staff work emails are invited as admins in 멤버.

Mentor phone numbers are entered by admins in 멘토 > 정보 수정. Only admins and the mentor can read them; students receive mentor details only through `student_board()`, which does not include the phone.

To bulk-import or update from a CSV (for example when the phone column arrives):

```bash
npm run import-roster -- path/to/roster.csv
```

Header: `이름,이메일,권역,지역,전화번호` (or `name,email,region_group,region,phone`; phone is optional). Rows are matched by email and updated; nothing is deleted. A blank or non-numeric phone cell (e.g. "미등록") never erases a number already stored. Keep roster files out of git.

Student records created by the previous phone-number screen are kept. They appear in the 학생 tab as "이전 기록" and are linked automatically when someone signs up with the same phone number.

## Test accounts

One account per role, flagged `is_test`. By design the test student only sees the hidden "테스트 멘토" (and real students never see it), so testing never uses up a real mentor's slot. Admin screens hide test data unless "테스트 계정 포함" is ticked. Emails are Gmail "+" aliases of the owner address, so test emails arrive in that inbox.

```bash
npm run test-accounts -- create   # prints generated passwords once
npm run test-accounts -- remove   # deletes all test rows, bookings and every "+" alias login
```

Set `TEST_ACCOUNT_PASSWORD` in `.env` to give the test student and mentor an easy demo password. The test admin always gets a random password, because it can read real students' contact details.

## Development

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run lint
```

`npm test` covers the booking rules, KST date handling, validation, error messages, email limits and email templates. The booking rules are enforced again in the database (`public.slot_rule_violation`).

## Project structure

```
app/
  (auth)/            login, signup (+ email code), forgot-password, set-password, server actions
  auth/confirm/      exchanges email links for a session
  student/ mentor/   role home pages (server page + client app)
  admin/             dashboard, tabs/, modals/, server actions for invitations
  not-found.js       404
components/
  ui/                Button, Field (incl. PasswordInput, InfoTip), Modal, Tabs, Chip, Toast, Alert, ...
  booking/           BookingBoard, SelectionTray, MonthCalendar, SessionStatusPicker, shared modals
  layout/            TopBar, AuthShell, PageHero
lib/
  supabase/          browser, server, service-role and proxy clients
  auth/              role lookup and page guards (session.js), code and link generation (links.js)
  email/             SMTP sending, limits, templates
  booking/           constants, KST dates, rules (mirror of the DB rules), session statuses, query columns
proxy.js             refreshes the session cookie, redirects signed-out users
supabase/migrations/ schema, RLS, booking and session-log functions
scripts/             test-accounts, import-roster
tests/               Vitest unit tests
```

## Notes

- **Browser translation.** Chrome's translate feature rewrites page text. Components keep text in their own elements and never insert nodes next to bare text, which is what caused the "Failed to execute 'insertBefore'" crash when translation was on. Keep that pattern (see `components/ui/Button.js`) when adding components.
- Sign-up tells people whether their email is on the roster. That is required to show "contact the office", but it means the roster can be probed one email at a time; the per-address and hourly email limits slow this down.
- Students on the board can see that a slot is taken, not by whom. Booking rows expose only an internal student number to other students.
- Admins can only assign students who already have an account (or an old record), because a booking needs a phone number to reach the student.
