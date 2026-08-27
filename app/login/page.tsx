import { Suspense } from "react";

import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Drawer Inventory",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span aria-hidden className="text-5xl">
            🍪
          </span>
          <h1 className="mt-3 text-2xl font-bold text-ink">Drawer Inventory</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to see what is in your drawer.</p>
        </div>

        <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm shadow-black/[0.04]">
          {/* LoginForm reads ?next= via useSearchParams, which opts the tree
              out of prerendering unless it sits behind a Suspense boundary. */}
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
          Accounts are created by the administrator.
          <br />
          There is no public sign-up.
        </p>
      </div>
    </main>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
