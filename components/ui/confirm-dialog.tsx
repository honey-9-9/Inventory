"use client";

import { useState } from "react";

import { Button } from "./button";
import { Modal } from "./modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

/**
 * Destructive actions never fire straight from a click - they route through
 * here so there is always an explicit confirmation step.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open={open} onClose={working ? () => {} : onCancel} title={title}>
      <div className="space-y-6">
        <div className="text-sm leading-relaxed text-ink-soft">{message}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={working}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={handleConfirm} loading={working}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
