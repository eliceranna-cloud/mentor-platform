import { requireRole } from "@/lib/auth/session";
import { ADMIN_BOOKING_COLUMNS, ADMIN_MENTOR_COLUMNS, ADMIN_STUDENT_COLUMNS } from "@/lib/booking/queries";
import { AdminApp } from "./AdminApp";

export const metadata = { title: "운영 관리" };

export default async function AdminPage() {
  const { supabase, user } = await requireRole("admin");

  const results = await Promise.all([
    supabase.from("regions").select("*").order("sort_order"),
    supabase.from("mentors").select(ADMIN_MENTOR_COLUMNS).order("id"),
    supabase.from("bookings").select(ADMIN_BOOKING_COLUMNS).is("cancelled_at", null),
    supabase.from("students").select(ADMIN_STUDENT_COLUMNS).order("name"),
    supabase.from("admins").select("*").order("created_at"),
    supabase.rpc("admin_student_roster"),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;

  const [regions, mentors, bookings, students, admins, roster] = results.map((r) => r.data);
  const me = admins.find((a) => a.user_id === user.id);

  return (
    <AdminApp
      me={me}
      initial={{ regions, mentors, bookings, students, admins, roster }}
    />
  );
}
