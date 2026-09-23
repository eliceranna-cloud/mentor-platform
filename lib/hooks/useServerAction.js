"use client";

import { useCallback, useState, useTransition } from "react";
import { toUserMessage } from "@/lib/errors";

/**
 * Runs a server action that returns { ok, error, ... } and tracks pending and
 * error state for the form. Network failures become a readable message instead
 * of an unhandled rejection.
 *
 *   const { run, pending, error } = useServerAction(signIn);
 *   run(values, (result) => router.replace(result.redirectTo));
 */
export function useServerAction(action) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const run = useCallback(
    (input, onSuccess, onFailure) =>
      startTransition(async () => {
        setError(null);
        try {
          const result = await action(input);
          if (result?.ok) onSuccess?.(result);
          else {
            setError(result?.error ?? toUserMessage({}));
            onFailure?.(result);
          }
        } catch (err) {
          setError(toUserMessage(err));
        }
      }),
    [action]
  );

  return { run, pending, error, setError };
}
