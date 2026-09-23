import { requireRole } from "@/lib/auth/session";
import { StudentApp } from "./StudentApp";

export const metadata = { title: "예약하기" };

export default async function StudentPage() {
  const { supabase } = await requireRole("student");

  // First render comes from the server; the client keeps it live afterwards.
  const [board, bookings] = await Promise.all([supabase.rpc("student_board"), supabase.rpc("student_bookings")]);
  if (board.error) throw board.error;
  if (bookings.error) throw bookings.error;

  return <StudentApp initialBoard={board.data} initialBookings={bookings.data} />;
}
