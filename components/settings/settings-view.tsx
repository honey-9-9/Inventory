"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { removeDemoData, updateLowStockThreshold } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { SessionUser } from "@/lib/types";

type SettingsViewProps = {
  user: SessionUser;
  lowStockThreshold: number;
  demoItemCount: number;
};

export function SettingsView({ user, lowStockThreshold, demoItemCount }: SettingsViewProps) {
  const router = useRouter();
  const { notify } = useToast();

  const [threshold, setThreshold] = useState(String(lowStockThreshold));
  const [thresholdError, setThresholdError] = useState<string | undefined>();
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [confirmingDemoRemoval, setConfirmingDemoRemoval] = useState(false);

  async function saveThreshold(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setThresholdError(undefined);

    const formData = new FormData();
    formData.set("threshold", threshold);

    setSavingThreshold(true);
    const result = await updateLowStockThreshold(formData);
    setSavingThreshold(false);

    if (!result.ok) {
      setThresholdError(result.fieldErrors?.threshold ?? result.error);
      return;
    }

    notify(`Low stock now means ${result.data} or fewer.`);
    router.refresh();
  }

  async function confirmRemoveDemoData() {
    const result = await removeDemoData();
    setConfirmingDemoRemoval(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(
      `Removed ${result.data.items} sample item${result.data.items === 1 ? "" : "s"}` +
        (result.data.categories > 0
          ? ` and ${result.data.categories} sample categor${result.data.categories === 1 ? "y" : "ies"}.`
          : "."),
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Tune how the app behaves.</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-black/[0.03] sm:p-6">
        <h2 className="text-base font-bold text-ink">Low stock threshold</h2>
        <p className="mt-1 text-sm text-ink-soft">
          An available item is flagged as low stock when its quantity drops to this number or
          below. Finished items are never counted as low stock — they have their own status.
        </p>

        <form onSubmit={saveThreshold} noValidate className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-40">
            <TextField
              label="Threshold"
              required
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              error={thresholdError}
            />
          </div>
          <Button type="submit" loading={savingThreshold}>
            Save
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-black/[0.03] sm:p-6">
        <h2 className="text-base font-bold text-ink">Sample data</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The app ships with a few example items so there is something to look at straight away.
          Removing them leaves everything you have added yourself untouched.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            onClick={() => setConfirmingDemoRemoval(true)}
            disabled={demoItemCount === 0}
          >
            Remove demo data
          </Button>
          <p className="text-sm text-ink-soft">
            {demoItemCount === 0
              ? "No sample items left."
              : `${demoItemCount} sample item${demoItemCount === 1 ? "" : "s"} remaining.`}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-black/[0.03] sm:p-6">
        <h2 className="text-base font-bold text-ink">Account</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Name</dt>
            <dd className="font-semibold text-ink">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Email</dt>
            <dd className="truncate font-semibold text-ink">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Role</dt>
            <dd className="font-semibold capitalize text-ink">{user.role}</dd>
          </div>
        </dl>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Roles are assigned outside the app, with the service-role key, so no account can
            change its own permissions. Edit the credentials in <code>.env.local</code> and run{" "}
            <code>npm run db:seed-users</code> to change them.
          </span>
        </p>
      </section>

      <ConfirmDialog
        open={confirmingDemoRemoval}
        title="Remove the sample data?"
        message={
          <>
            This deletes the {demoItemCount} item{demoItemCount === 1 ? "" : "s"} that came with
            the app, plus any sample categories left empty afterwards. Your own items are not
            affected. This action cannot be undone.
          </>
        }
        confirmLabel="Remove demo data"
        onConfirm={confirmRemoveDemoData}
        onCancel={() => setConfirmingDemoRemoval(false)}
      />
    </div>
  );
}
