// Column lists shared by the server page (first render) and the client
// component (realtime refresh), so both always fetch the same shape.

/** Mentor screen: their bookings with the booked student's contact details. */
export const MENTOR_BOOKING_COLUMNS =
  "id, student_id, booking_date, booking_time, session_status, students(name, phone, region)";

/** Admin board and list: every active booking with the student behind it. */
export const ADMIN_BOOKING_COLUMNS =
  "id, mentor_id, student_id, booking_date, booking_time, session_status, students(id, name, phone, email, region_group, region, is_test)";

export const ADMIN_MENTOR_COLUMNS =
  "id, name, field, intro, region_group, meeting_link, email, phone, user_id, invited_at, activated_at, is_test";

export const ADMIN_STUDENT_COLUMNS = "id, name, phone, email, region_group, region, is_test, user_id";
