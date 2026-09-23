"use client";

import { useCallback, useState } from "react";
import { ADMIN_BOOKING_COLUMNS, ADMIN_MENTOR_COLUMNS, ADMIN_STUDENT_COLUMNS } from "@/lib/booking/queries";
import { useBookingsRealtime } from "@/lib/hooks/useBookingsRealtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * All admin dashboard data, first loaded on the server, then refreshed per
 * area after a change. Bookings also refresh live via realtime, so two admins
 * (or an admin and a student) never look at stale slots for long.
 */
export function useAdminData(initial) {
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState(initial);

  const fetchers = {
    bookings: () => supabase.from("bookings").select(ADMIN_BOOKING_COLUMNS).is("cancelled_at", null),
    mentors: () => supabase.from("mentors").select(ADMIN_MENTOR_COLUMNS).order("id"),
    students: () => supabase.from("students").select(ADMIN_STUDENT_COLUMNS).order("name"),
    admins: () => supabase.from("admins").select("*").order("created_at"),
    roster: () => supabase.rpc("admin_student_roster"),
  };

  /** reload("bookings", "roster") refreshes just those parts. */
  const reload = useCallback(
    async (...keys) => {
      const results = await Promise.all(keys.map((key) => fetchers[key]()));
      setData((current) => {
        const next = { ...current };
        keys.forEach((key, i) => {
          if (!results[i].error) next[key] = results[i].data;
        });
        return next;
      });
    },
    // fetchers only close over the stable supabase client
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase]
  );

  // Booking changes also change per-student counts on the Students tab.
  const onBookingChange = useCallback(() => reload("bookings", "roster"), [reload]);
  useBookingsRealtime("admin-bookings", onBookingChange);

  return { ...data, reload, supabase };
}
