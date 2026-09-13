"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/validation";

type AnyAction = (...args: never[]) => Promise<ActionState>;

/**
 * Wrap a server action with pending state + toast feedback. `onSuccess` runs
 * after a successful (ok === true) action so callers can close dialogs,
 * refresh data, or navigate.
 *
 * The action is awaited in a plain async function (not a React transition) so
 * that a `router.push()` in `onSuccess` starts the navigation immediately and
 * shows the loading skeleton right away. Wrapping it in `useTransition` would
 * defer the navigation and leave the old page frozen until the destination
 * finishes rendering, which makes submits feel slow.
 */
export function useAction<T extends AnyAction>(
  action: T,
  onSuccess?: (res: Awaited<ReturnType<T>>) => void,
) {
  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);

  const run = async (...args: Parameters<T>) => {
    // Guard against double-submits (e.g. a fast double-click) which would
    // otherwise fire the action twice.
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(true);

    try {
      const res = await action(...(args as never[]));
      if (res.ok) {
        if (res.message) toast.success(res.message);
        onSuccess?.(res as Awaited<ReturnType<T>>);
      } else {
        toast.error(res.message || "Something went wrong.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      runningRef.current = false;
      setPending(false);
    }
  };

  return { pending, run };
}
