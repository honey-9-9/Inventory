"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { credentialsSchema, fieldErrorsFrom } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);

    setSubmitting(true);
    const result = await signIn(formData);

    if (!result.ok) {
      setSubmitting(false);
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      return;
    }

    // Only allow relative paths back, so a crafted ?next= cannot bounce the
    // user to another site after a successful sign-in.
    const next = searchParams.get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : result.data;

    router.replace(destination);
    // Discard the cached signed-out render so the shell picks up the session.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Email"
        required
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        placeholder="you@example.com"
        disabled={submitting}
      />

      <TextField
        label="Password"
        required
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        placeholder="••••••••"
        disabled={submitting}
      />

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-finished-fg"
        >
          {formError}
        </p>
      ) : null}

      <Button type="submit" loading={submitting} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
