"use client";

import { useState, useTransition } from "react";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SignOutButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-finished-bg hover:text-finished-fg disabled:opacity-60"
      >
        <LogOut className="size-4.5 shrink-0" aria-hidden />
        <span>{pending ? "Signing out..." : "Logout"}</span>
      </button>

      <ConfirmDialog
        open={confirming}
        title="Sign out?"
        message="You will need to sign in again to see your drawer."
        confirmLabel="Sign out"
        tone="primary"
        onConfirm={() => startTransition(() => void signOut())}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
