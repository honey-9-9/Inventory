"use client";

/* eslint-disable @next/next/no-img-element -- previews are blob:/uploads URLs,
   which next/image cannot optimise. */

import { useRef, useState } from "react";

import { Camera, ImageUp, Loader2, Trash2 } from "lucide-react";

import { uploadItemImage } from "@/app/actions/images";
import { Button } from "@/components/ui/button";
import { downscaleImage } from "@/lib/downscale-image";

type ImagePickerProps = {
  /** Current image URL, or null when the item has no photo. */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Called with each newly stored URL so the form can tidy up on cancel. */
  onUploaded?: (url: string) => void;
  itemName: string;
};

export function ImagePicker({ value, onChange, onUploaded, itemName }: ImagePickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const resized = await downscaleImage(file);

      const formData = new FormData();
      formData.set("file", resized);

      const result = await uploadItemImage(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onChange(result.data);
      onUploaded?.(result.data);
    } catch {
      setError("That image could not be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-ink">
        Photo <span className="ml-1.5 text-xs font-normal text-ink-soft">optional</span>
      </span>

      <div className="flex items-start gap-3">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas">
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-ink-soft" aria-hidden />
          ) : value ? (
            <img
              src={value}
              alt={itemName ? `Photo of ${itemName}` : "Item photo"}
              className="size-full object-cover"
            />
          ) : (
            <ImageUp className="size-6 text-ink-soft" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <ImageUp className="size-4" aria-hidden />
              {value ? "Change" : "Choose file"}
            </Button>

            {/*
              `capture` makes a phone open the camera directly instead of the
              gallery. On a desktop the attribute is ignored and this behaves
              like a normal file picker, so the button is safe to always show.
            */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => cameraInput.current?.click()}
              disabled={uploading}
            >
              <Camera className="size-4" aria-hidden />
              Take photo
            </Button>

            {value ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setError(null);
                }}
                disabled={uploading}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-ink-soft">
            JPEG, PNG, WebP or GIF. Large photos are shrunk automatically before
            they are saved.
          </p>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      {error ? (
        <p role="alert" className="text-xs font-medium text-finished-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
