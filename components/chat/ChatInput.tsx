"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ImagePlusIcon, SendIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatImage } from "@/types/chat";

interface ChatInputProps {
  onSend: (text: string, images: ChatImage[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_IMAGES = 4;
const MAX_DIMENSION_PX = 1200;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Read a File as a base64 data URL, then optionally downscale via <canvas>
 * so a 4 MB phone photo becomes a ~200 KB jpeg. Skips the resize for small
 * images and for formats the browser can't safely re-encode (animated GIF).
 */
async function fileToChatImage(file: File): Promise<ChatImage> {
  const dataUrl = await readAsDataUrl(file);
  const downscaled = await maybeDownscale(dataUrl, file.type);
  return {
    dataUrl: downscaled,
    mimeType: file.type,
    size: approxBytes(downscaled),
    name: file.name,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

async function maybeDownscale(
  dataUrl: string,
  mimeType: string
): Promise<string> {
  // Only downscale raster types we can safely re-encode. Animated GIFs and
  // SVG would lose animation / fidelity if we round-tripped through canvas.
  if (mimeType === "image/gif" || mimeType === "image/svg+xml") return dataUrl;

  const img = await loadImage(dataUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_DIMENSION_PX) {
    // Still re-encode as JPEG if it's a PNG with alpha — but only when it's
    // actually oversized. For in-range PNGs we keep the data URL as-is.
    return dataUrl;
  }

  const scale = MAX_DIMENSION_PX / longest;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  // PNG with transparency → keep as PNG. Otherwise re-encode as JPEG to
  // dramatically reduce size.
  const outType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = outType === "image/jpeg" ? 0.85 : undefined;
  return canvas.toDataURL(outType, quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function approxBytes(dataUrl: string): number {
  // dataUrl is `data:<mime>;base64,<payload>`. base64 length × 3/4 is the
  // byte count of the payload; the mime prefix is negligible.
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx === -1 ? "" : dataUrl.slice(commaIdx + 1);
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Multiline chat input with image attachment support.
 *
 * - Paperclip button on the left opens a file picker (image-only, multi).
 * - Picked files are read → downscaled (if oversized) → stored as base64
 *   data URLs in `pendingImages` state.
 * - Thumbnails appear above the input with an X-to-remove per image.
 * - Enter sends (Shift+Enter = newline). If images are attached, they're
 *   cleared from the input state once the message goes out.
 * - Disabled while a stream is in flight (text + images both locked).
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Reply to Stitch Talk…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && pendingImages.length === 0) || disabled) return;
    onSend(trimmed, pendingImages);
    setValue("");
    setPendingImages([]);
    setError(null);
    // Reset auto-sized height and re-focus so the user can keep typing
    // without reaching for the mouse.
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.focus();
    }
  }, [value, pendingImages, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const room = MAX_IMAGES - pendingImages.length;
      if (room <= 0) {
        setError(`You can attach up to ${MAX_IMAGES} images per message.`);
        return;
      }

      const accepted: File[] = [];
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError(
            `"${file.name || "file"}" isn't a supported image type. Use JPG, PNG, WebP, or GIF.`
          );
          continue;
        }
        accepted.push(file);
        if (accepted.length >= room) break;
      }
      if (accepted.length === 0) return;

      try {
        const processed = await Promise.all(accepted.map(fileToChatImage));
        setPendingImages((prev) => [...prev, ...processed].slice(0, MAX_IMAGES));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to process image";
        setError(message);
      }
    },
    [pendingImages.length]
  );

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Drag-and-drop: also supported as a nicety. Keeps the UX familiar for
  // anyone used to uploading into chat.
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const canSend =
    !disabled && (value.trim().length > 0 || pendingImages.length > 0);

  return (
    <div
      className={`border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors ${
        isDragging ? "ring-2 ring-primary/40 ring-inset" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-3 space-y-2">
        {pendingImages.length > 0 && (
          <PendingImagesRow images={pendingImages} onRemove={removeImage} />
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files);
              // Reset so picking the same file twice in a row still fires.
              e.target.value = "";
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || pendingImages.length >= MAX_IMAGES}
            aria-label={`Attach image${pendingImages.length ? "s" : ""} (max ${MAX_IMAGES})`}
            title="Attach image"
            className="size-10 shrink-0"
          >
            <ImagePlusIcon />
          </Button>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Type your message"
            className="min-h-10 max-h-50 resize-none py-2.5"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send message"
            className="size-10 shrink-0"
          >
            <SendIcon />
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for newline · attach up to {MAX_IMAGES} images
        </p>
      </div>
    </div>
  );
}

function PendingImagesRow({
  images,
  onRemove,
}: {
  images: ChatImage[];
  onRemove: (index: number) => void;
}) {
  return (
    <div
      role="list"
      aria-label="Pending image attachments"
      className="flex flex-wrap gap-2"
    >
      {images.map((img, i) => (
        <div
          key={`${img.name ?? "img"}-${i}`}
          role="listitem"
          className="relative group size-16 sm:size-20 rounded-lg overflow-hidden border border-border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.dataUrl}
            alt={img.name ?? `Attachment ${i + 1}`}
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${img.name ?? `attachment ${i + 1}`}`}
            className="absolute top-0.5 right-0.5 size-5 grid place-items-center rounded-full bg-background/85 text-foreground shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-background"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
