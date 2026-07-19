"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

/**
 * Primary dashboard action: open a tiny create dialog, then route into
 * the mock empty project. Keeps creation to one field.
 */
export function NewProjectButton({
  variant = "primary",
}: {
  variant?: "primary" | "empty";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const titleId = useId();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Mock: always land on the empty "market" project as a fresh workspace.
    setOpen(false);
    setName("");
    router.push("/projects/market");
  };

  return (
    <>
      <button
        type="button"
        className={variant === "empty" ? "btn btn-thread" : "btn btn-thread"}
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        New project
      </button>

      {open && (
        <div className="modal-root" role="presentation">
          <button
            type="button"
            className="modal-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            className="modal-sheet modal-sheet--sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <XIcon />
            </button>
            <p className="modal-kicker">New project</p>
            <h2 id={titleId} className="modal-title">
              Name the work
            </h2>
            <p className="modal-desc">
              A project holds every design thread for one product or brand.
            </p>
            <form onSubmit={submit} className="create-form">
              <label className="field">
                <span className="field-label">Project name</span>
                <input
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aurora Health"
                  autoFocus
                  required
                />
              </label>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-thread"
                  disabled={!name.trim()}
                >
                  Create project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
