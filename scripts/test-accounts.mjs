#!/usr/bin/env node
// Creates or removes one test account per role in the connected Supabase project.
//
//   npm run test-accounts -- create   (prints the generated passwords once)
//   npm run test-accounts -- remove   (deletes every is_test row and every "+" alias login)
//
// Test rows are flagged is_test: the test student only sees the test mentor,
// real students never see either, and admin screens hide them unless
// "테스트 계정 포함" is ticked. Needs SUPABASE_SERVICE_ROLE_KEY in .env.

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Gmail "+" aliases of the owner, so any email these accounts trigger lands in
// the owner's inbox. Change TEST_EMAIL_BASE to use another mailbox.
const TEST_EMAIL_BASE = process.env.TEST_EMAIL_BASE ?? "calistasalsa.cpw@gmail.com";
const [local, domain] = TEST_EMAIL_BASE.split("@");
const alias = (tag) => `${local}+${tag}@${domain}`;

const ACCOUNTS = {
  admin: { email: alias("admin"), name: "테스트 관리자" },
  mentor: { email: alias("mentor"), name: "테스트 멘토" },
  student: { email: alias("student"), name: "테스트 학생", phone: "010-0000-0000" },
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/**
 * TEST_ACCOUNT_PASSWORD (optional) gives the student and mentor an easy demo
 * password. The admin always gets a random one: it can read real students'
 * contact details, so it must not be guessable.
 */
function passwordFor(role) {
  if (role !== "admin" && process.env.TEST_ACCOUNT_PASSWORD) return process.env.TEST_ACCOUNT_PASSWORD;
  return `${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}7a`; // letters + digits
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function create() {
  // Roster / profile rows first: the auth trigger links users to them and
  // rejects emails that are on no list.
  await must(
    supabase.from("whitelist_students").upsert(
      { email: ACCOUNTS.student.email, name: ACCOUNTS.student.name, region_group: "동남권", region: "울산", is_test: true },
      { onConflict: "email" }
    ),
    "whitelist"
  );
  const existingMentor = await must(supabase.from("mentors").select("id").eq("email", ACCOUNTS.mentor.email), "mentor lookup");
  if (!existingMentor.length) {
    await must(
      supabase.from("mentors").insert({
        name: ACCOUNTS.mentor.name,
        field: "테스트 분야",
        intro: "테스트 계정입니다. 실제 학생에게는 보이지 않아요.",
        region_group: "동남권",
        email: ACCOUNTS.mentor.email,
        is_test: true,
        invited_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
      }),
      "mentor"
    );
  }
  await must(
    supabase.from("admins").upsert(
      { email: ACCOUNTS.admin.email, name: ACCOUNTS.admin.name, is_test: true, activated_at: new Date().toISOString() },
      { onConflict: "email" }
    ),
    "admin"
  );

  console.log("Test accounts (passwords are shown once):");
  for (const [role, account] of Object.entries(ACCOUNTS)) {
    const password = passwordFor(role);
    const { error } = await supabase.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: account.phone ? { phone: account.phone } : {},
    });
    if (error && /already/i.test(error.message)) {
      console.log(`  ${role.padEnd(8)} ${account.email}  (already exists, password unchanged)`);
      continue;
    }
    if (error) throw new Error(`${role} user: ${error.message}`);
    console.log(`  ${role.padEnd(8)} ${account.email}  ${password}`);
  }
}

async function remove() {
  // Every "+" alias of the base address (test student / mentor / admin and any
  // extra ones used to try the sign-up flow). The base address itself is never matched.
  const isTestAlias = (email) => email?.startsWith(`${local}+`) && email.endsWith(`@${domain}`);

  // Only "+" alias rows: staff test entries on the roster (is_test, personal
  // emails added by hand) are kept. Deleting test students / the test mentor
  // also deletes their bookings (ON DELETE CASCADE).
  const aliasPattern = `${local}+%@${domain}`;
  await must(supabase.from("students").delete().eq("is_test", true).like("email", aliasPattern), "students");
  await must(supabase.from("mentors").delete().eq("is_test", true).like("email", aliasPattern), "mentors");
  await must(supabase.from("whitelist_students").delete().eq("is_test", true).like("email", aliasPattern), "whitelist");
  await must(supabase.from("admins").delete().eq("is_test", true).like("email", aliasPattern), "admins");

  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users.filter((u) => isTestAlias(u.email))) {
    await supabase.auth.admin.deleteUser(user.id);
  }
  console.log("Removed all test rows and test logins.");
}

const command = process.argv[2];
if (command === "create") await create();
else if (command === "remove") await remove();
else {
  console.error("Usage: npm run test-accounts -- create|remove");
  process.exit(1);
}
