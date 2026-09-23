"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 300;

/**
 * Calls `onChange` whenever a booking the user is allowed to see changes
 * (Row Level Security filters realtime events too). Also refreshes when the
 * tab becomes visible again, in case the socket dropped while it was hidden.
 *
 * This keeps the board live without caching: the board is always a fresh
 * read, and the database decides who gets a slot.
 */
export function useBookingsRealtime(channelName, onChange) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer;
    // Several events arrive together when a multi-slot booking lands; refetch once.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, schedule)
      .subscribe();

    const onVisible = () => document.visibilityState === "visible" && schedule();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [channelName]);
}
