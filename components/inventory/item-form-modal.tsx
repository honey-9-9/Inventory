"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Item } from "@/lib/types";
import { fieldErrorsFrom, itemSchema } from "@/lib/validation";

import { useInventory } from "./inventory-provider";

/** Starting points only - the Unit field stays free text so any unit works. */
const UNIT_SUGGESTIONS = [
  "packets",
  "pieces",
  "bottles",
  "cans",
  "boxes",
  "bars",
  "grams",
  "kilograms",
];

type ItemFormModalProps = {
  open: boolean;
  /** `null` means "add new"; an item means "edit that item". */
  item: Item | null;
  onClose: () => void;
};

/**
 * Gate + remount key.
 *
 * Keying the dialog on the item being edited means every open starts from a
 * fresh mount, so the fields initialise from props in `useState` rather than
 * being reset by an effect - and a half-typed draft can never leak into the
 * next item the user opens.
 */
export function ItemFormModal({ open, item, onClose }: ItemFormModalProps) {
  if (!open) return null;
  return <ItemFormDialog key={item?.id ?? "new"} item={item} onClose={onClose} />;
}

type FormState = {
  name: string;
  categoryId: string;
  quantity: string;
  unit: string;
  description: string;
  imageUrl: string;
  icon: string;
};

const BLANK: FormState = {
  name: "",
  categoryId: "",
  quantity: "1",
  unit: "packets",
  description: "",
  imageUrl: "",
  icon: "",
};

function ItemFormDialog({ item, onClose }: Omit<ItemFormModalProps, "open">) {
  const { categories, add, edit } = useInventory();
  const { notify } = useToast();

  const [form, setForm] = useState<FormState>(() =>
    item
      ? {
          name: item.name,
          categoryId: item.category_id,
          quantity: String(item.quantity),
          unit: item.unit,
          description: item.description ?? "",
          imageUrl: item.image_url ?? "",
          icon: item.icon ?? "",
        }
      : { ...BLANK, categoryId: categories[0]?.id ?? "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = item !== null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Same schema the server action runs, so the inline errors the user sees
    // are exactly the rules that will be enforced.
    const parsed = itemSchema.safeParse({
      name: form.name,
      categoryId: form.categoryId,
      quantity: form.quantity.trim() === "" ? Number.NaN : Number(form.quantity),
      unit: form.unit,
      description: form.description,
      imageUrl: form.imageUrl,
      icon: form.icon,
    });

    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    const formData = new FormData();
    formData.set("name", form.name);
    formData.set("categoryId", form.categoryId);
    formData.set("quantity", form.quantity);
    formData.set("unit", form.unit);
    formData.set("description", form.description);
    formData.set("imageUrl", form.imageUrl);
    formData.set("icon", form.icon);

    setSaving(true);
    const result = isEditing ? await edit(item.id, formData) : await add(formData);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      return;
    }

    notify(
      isEditing ? `Saved changes to "${result.data.name}".` : `Added "${result.data.name}".`,
    );
    onClose();
  }

  const noCategories = categories.length === 0;

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={isEditing ? "Edit item" : "Add item"}
      description={
        isEditing
          ? "Update the details for this item."
          : "Add something new to your drawer."
      }
      size="lg"
    >
      {noCategories ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            You need at least one category before you can add an item. Create one on the
            Categories page first.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <TextField
            label="Item name"
            required
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            error={errors.name}
            placeholder="Biscuits"
            maxLength={80}
            autoComplete="off"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              required
              value={form.categoryId}
              onChange={(event) => update("categoryId", event.target.value)}
              error={errors.categoryId}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Icon"
              value={form.icon}
              onChange={(event) => update("icon", event.target.value)}
              error={errors.icon}
              placeholder="🍪"
              maxLength={8}
              hint="An emoji shown on the card."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Quantity"
              required
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
              error={errors.quantity}
              hint="0 marks the item as finished."
            />

            <TextField
              label="Unit"
              required
              list="unit-suggestions"
              value={form.unit}
              onChange={(event) => update("unit", event.target.value)}
              error={errors.unit}
              placeholder="packets"
              maxLength={30}
              autoComplete="off"
              hint="Pick a suggestion or type your own."
            />
            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </div>

          <TextAreaField
            label="Description"
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            error={errors.description}
            placeholder="Chocolate biscuits"
            maxLength={500}
          />

          <TextField
            label="Image URL"
            type="url"
            value={form.imageUrl}
            onChange={(event) => update("imageUrl", event.target.value)}
            error={errors.imageUrl}
            placeholder="https://example.com/biscuits.jpg"
            hint="Leave blank to use the icon instead."
          />

          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-finished-fg"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEditing ? "Save changes" : "Add item"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
