"use client";

import { useId } from "react";

import { cn } from "@/lib/cn";

const CONTROL_BASE =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink transition placeholder:text-ink-soft/70 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

function controlClass(hasError: boolean, className?: string) {
  return cn(CONTROL_BASE, hasError ? "border-red-300 bg-red-50/40" : "border-line", className);
}

type FieldShellProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
};

function FieldShell({ label, error, hint, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-finished-fg" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-ink-soft">optional</span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-finished-fg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ label, error, hint, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={props.required}
      htmlFor={id}
    >
      <input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={controlClass(Boolean(error), className)}
        {...props}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({ label, error, hint, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} required={props.required} htmlFor={id}>
      <textarea
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={controlClass(Boolean(error), cn("resize-y", className))}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} required={props.required} htmlFor={id}>
      <select
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={controlClass(Boolean(error), cn("cursor-pointer appearance-none pr-9", className))}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236a7671' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.85rem center",
        }}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
