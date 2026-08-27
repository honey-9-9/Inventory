"use client";

import { useState } from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { createCategory, deleteCategory, renameCategory } from "@/app/actions/categories";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ActionResult, CategoryRow, CategoryWithUsage } from "@/lib/types";

type Dialog =
  | { kind: "create" }
  | { kind: "rename"; category: CategoryWithUsage }
  | { kind: "delete"; category: CategoryWithUsage }
  | null;

export function CategoriesView({ categories }: { categories: CategoryWithUsage[] }) {
  const { notify } = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Categories</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Group your items however makes sense to you.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus className="size-4" aria-hidden />
          New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="No categories yet"
          message="Create your first category to start adding items."
          action={
            <Button onClick={() => setDialog({ kind: "create" })}>
              <Plus className="size-4" aria-hidden />
              New category
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/[0.03]">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{category.name}</p>
                <p className="text-xs text-ink-soft">
                  {category.itemCount === 0
                    ? "No items"
                    : `${category.itemCount} item${category.itemCount === 1 ? "" : "s"}`}
                  {category.is_demo ? " · sample category" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ kind: "rename", category })}
                aria-label={`Rename ${category.name}`}
                className="cursor-pointer rounded-lg p-2 text-ink-soft transition hover:bg-canvas hover:text-ink"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: "delete", category })}
                aria-label={`Delete ${category.name}`}
                className="cursor-pointer rounded-lg p-2 text-ink-soft transition hover:bg-finished-bg hover:text-finished-fg"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === "create" || dialog?.kind === "rename" ? (
        <CategoryNameDialog
          key={dialog.kind === "rename" ? dialog.category.id : "create"}
          mode={dialog.kind}
          initialName={dialog.kind === "rename" ? dialog.category.name : ""}
          onClose={() => setDialog(null)}
          onSubmit={async (formData) => {
            const result =
              dialog.kind === "rename"
                ? await renameCategory(dialog.category.id, formData)
                : await createCategory(formData);

            if (result.ok) {
              notify(
                dialog.kind === "rename"
                  ? `Renamed to "${result.data.name}".`
                  : `Created "${result.data.name}".`,
              );
              setDialog(null);
            }
            return result;
          }}
        />
      ) : null}

      {dialog?.kind === "delete" ? (
        <DeleteCategoryDialog
          category={dialog.category}
          others={categories.filter((entry) => entry.id !== dialog.category.id)}
          onClose={() => setDialog(null)}
          onConfirm={async (reassignToId) => {
            const result = await deleteCategory(dialog.category.id, reassignToId);
            if (result.ok) {
              notify(`Deleted "${dialog.category.name}".`);
              setDialog(null);
            }
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

type NameDialogProps = {
  mode: "create" | "rename";
  initialName: string;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<ActionResult<CategoryRow>>;
};

function CategoryNameDialog({ mode, initialName, onClose, onSubmit }: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(undefined);

    if (name.trim().length === 0) {
      setFieldError("Category name is required");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);

    setSaving(true);
    const result = await onSubmit(formData);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setFieldError(result.fieldErrors?.name);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={mode === "rename" ? "Rename category" : "New category"}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Category name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError}
          placeholder="Snacks"
          maxLength={40}
          autoComplete="off"
        />

        {error && !fieldError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-finished-fg"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {mode === "rename" ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type DeleteDialogProps = {
  category: CategoryWithUsage;
  others: CategoryWithUsage[];
  onClose: () => void;
  onConfirm: (reassignToId: string | null) => Promise<ActionResult<string>>;
};

/**
 * A category holding items cannot simply be deleted (the foreign key forbids
 * it), so this dialog makes the safe path the obvious one: choose where the
 * items should move, then delete. No item is ever removed by this flow.
 */
function DeleteCategoryDialog({ category, others, onClose, onConfirm }: DeleteDialogProps) {
  const inUse = category.itemCount > 0;
  const [reassignTo, setReassignTo] = useState(others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const blocked = inUse && others.length === 0;

  async function handleConfirm() {
    setError(null);

    if (inUse && !reassignTo) {
      setError("Choose a category to move these items into.");
      return;
    }

    setWorking(true);
    const result = await onConfirm(inUse ? reassignTo : null);
    setWorking(false);

    if (!result.ok) setError(result.error);
  }

  return (
    <Modal open onClose={working ? () => {} : onClose} title={`Delete "${category.name}"?`}>
      <div className="space-y-5">
        {blocked ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            This category has {category.itemCount} item
            {category.itemCount === 1 ? "" : "s"} and it is your only category. Create another
            category first so those items have somewhere to go.
          </p>
        ) : inUse ? (
          <>
            <p className="text-sm leading-relaxed text-ink-soft">
              {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
              {category.itemCount === 1 ? " uses" : " use"} this category. Choose where to move
              {category.itemCount === 1 ? " it" : " them"} — no items will be deleted.
            </p>
            <SelectField
              label="Move items to"
              required
              value={reassignTo}
              onChange={(event) => setReassignTo(event.target.value)}
            >
              {others.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </SelectField>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            This category has no items. This action cannot be undone.
          </p>
        )}

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-finished-fg"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={working} disabled={blocked}>
            {inUse ? "Move items and delete" : "Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
