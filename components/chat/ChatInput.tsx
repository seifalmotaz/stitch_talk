"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ImagePlusIcon, SendIcon, XIcon } from "lucide-react";

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
 * so a 4 MB phone photo becomes a ~200 KB jpeg.
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
  if (mimeType === "image/gif" || mimeType === "image/svg+xml") return dataUrl;

  const img = await loadImage(dataUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_DIMENSION_PX) {
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
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx === -1 ? "" : dataUrl.slice(commaIdx + 1);
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Floating atelier composer — attach references, type, send.
 * Enter sends; Shift+Enter newline. Drag-and-drop images supported.
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Describe the feeling, audience, or a reference…",
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
    <div className="composer">
      <div className={`composer-panel${isDragging ? " is-dragging" : ""}`}>
        {pendingImages.length > 0 && (
          <PendingImagesRow images={pendingImages} onRemove={removeImage} />
        )}

        {error && (
          <p role="alert" className="composer-error">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="composer-row"
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
              e.target.value = "";
            }}
          />

          <button
            type="button"
            className="composer-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || pendingImages.length >= MAX_IMAGES}
            aria-label={`Attach image${pendingImages.length ? "s" : ""} (max ${MAX_IMAGES})`}
            title="Pin a reference image"
          >
            <ImagePlusIcon />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Type your message"
            className="composer-textarea"
          />

          <button
            type="submit"
            className="composer-send"
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </div>
      <p className="composer-hint">
        Enter to send · Shift+Enter for newline · pin up to {MAX_IMAGES}{" "}
        references
      </p>
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
      className="composer-pending"
    >
      {images.map((img, i) => (
        <div
          key={`${img.name ?? "img"}-${i}`}
          role="listitem"
          className="composer-thumb"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.dataUrl}
            alt={img.name ?? `Attachment ${i + 1}`}
          />
          <button
            type="button"
            className="composer-thumb-remove"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${img.name ?? `attachment ${i + 1}`}`}
          >
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
