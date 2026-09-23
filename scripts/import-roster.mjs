#!/usr/bin/env node
// Adds or updates students in the sign-up roster (public.whitelist_students)
// from a CSV file. Existing rows are updated by email; nothing is deleted.
//
//   npm run import-roster -- path/to/roster.csv
//
// CSV header (Korean or English names both work; phone is optional):
//   이름,이메일,권역,지역,전화번호
//   name,email,region_group,region,phone
//
// Keep roster files out of git: they contain personal data.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { formatPhone, isValidPhone } from "../lib/validation.js";

const HEADER_ALIASES = {
  이름: "name",
  name: "name",
  이메일: "email",
  email: "email",
  권역: "region_group",
  region_group: "region_group",
  지역: "region",
  region: "region",
  전화번호: "phone",
  번호: "phone",
  phone: "phone",
};

/** Minimal RFC 4180 parser: handles quoted fields, commas and quotes inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      (row = []), (field = "");
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run import-roster -- path/to/roster.csv");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const [header, ...lines] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const columns = header.map((h) => HEADER_ALIASES[h.trim()] ?? null);
for (const required of ["name", "email", "region_group", "region"]) {
  if (!columns.includes(required)) {
    console.error(`Missing column: ${required}. Found: ${header.join(", ")}`);
    process.exit(1);
  }
}

const { data: regions } = await supabase.from("regions").select("name, areas");
const validAreas = new Map(regions.map((r) => [r.name, r.areas]));

const records = [];
const problems = [];
lines.forEach((line, i) => {
  const record = {};
  columns.forEach((key, c) => key && (record[key] = (line[c] ?? "").trim()));
  record.email = record.email.toLowerCase();
  // "미등록" (no number in LXP) and other non-numbers are treated as blank.
  if (!isValidPhone(record.phone)) delete record.phone;
  else record.phone = formatPhone(record.phone);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) problems.push(`line ${i + 2}: invalid email "${record.email}"`);
  else if (!validAreas.get(record.region_group)?.includes(record.region)) {
    problems.push(`line ${i + 2}: unknown region "${record.region_group} / ${record.region}"`);
  } else records.push(record);
});

if (problems.length) {
  console.error(`Nothing imported. Fix these rows first:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// Rows with and without a phone go in separate batches: in one mixed batch a
// blank phone cell would overwrite a number that is already stored.
const withPhone = records.filter((r) => r.phone);
const withoutPhone = records.filter((r) => !r.phone);
for (const batch of [withPhone, withoutPhone].filter((b) => b.length)) {
  const { error } = await supabase.from("whitelist_students").upsert(batch, { onConflict: "email" });
  if (error) {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  }
}
console.log(`Imported ${records.length} roster rows (added or updated), ${withPhone.length} with a phone number.`);
