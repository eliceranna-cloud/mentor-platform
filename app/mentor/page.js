import { requireRole } from "@/lib/auth/session";
import { MENTOR_BOOKING_COLUMNS } from "@/lib/booking/queries";
import { MentorApp } from "./MentorApp";

export const metadata = { title: "내 멘토링 일정" };

export default async function MentorPage() {
  const { supabase, user } = await requireRole("mentor");

  const { data: mentor, error } = await supabase
    .from("mentors")
    .select("id, name, field, region_group, meeting_link")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;

  const [region, bookings] = await Promise.all([
    supabase.from("regions").select("*").eq("name", mentor.region_group).single(),
    supabase.from("bookings").select(MENTOR_BOOKING_COLUMNS).eq("mentor_id", mentor.id).is("cancelled_at", null),
  ]);
  if (region.error) throw region.error;
  if (bookings.error) throw bookings.error;

  return <MentorApp mentor={mentor} region={region.data} initialBookings={bookings.data} />;
}
