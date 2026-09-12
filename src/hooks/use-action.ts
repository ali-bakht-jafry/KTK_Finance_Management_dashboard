"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/validation";

type AnyAction = (...args: never[]) => Promise<ActionState>;

/**
 * Wrap a server action with pending state + toast feedback. `onSuccess` runs
 * after a successful (ok === true) action so callers can close dialogs,
 * refresh data, or navigate.
 */
export function useAction<T extends AnyAction>(
  action: T,
  onSuccess?: (res: Awaited<ReturnType<T>>) => void,
) {
  const [pending, startTransition] = useTransition();

  const run = (...args: Parameters<T>) => {
    startTransition(async () => {
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
      }
    });
  };

  return { pending, run };
}
