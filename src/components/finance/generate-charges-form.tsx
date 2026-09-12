"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import type { ActionState } from "@/lib/validation";

export function GenerateChargesForm({
  action,
  label,
  defaultPeriod,
}: {
  action: (input: { period: string }) => Promise<ActionState>;
  label: string;
  defaultPeriod: string;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(defaultPeriod);

  const { pending, run } = useAction(action, () => {
    toast.success(`${label} charges generated for ${period}.`);
    router.refresh();
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run({ period });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`gen-${label}`}>Month</Label>
        <Input
          id={`gen-${label}`}
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Creates a {label.toLowerCase()} charge for every active resident with a non-zero{" "}
        {label.toLowerCase()} rate, using their current rate. Existing charges for the month are left
        untouched.
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : `Generate ${label} charges`}
        </Button>
      </div>
    </form>
  );
}
