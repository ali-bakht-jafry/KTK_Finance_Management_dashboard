"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import type { ActionState } from "@/lib/validation";

type ConfirmButtonProps = {
  action: (input: { id: string }) => Promise<ActionState>;
  id: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  children?: React.ReactNode;
  onSuccess?: () => void;
};

export function ConfirmButton({
  action,
  id,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  buttonVariant = "destructive",
  buttonSize = "sm",
  children,
  onSuccess,
}: ConfirmButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction(action, () => {
    setOpen(false);
    router.refresh();
    onSuccess?.();
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children ?? (
          <Button variant={buttonVariant} size={buttonSize}>
            {confirmLabel}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={buttonVariant}
            disabled={pending}
            onClick={() => run({ id })}
          >
            {pending ? "Please wait…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
