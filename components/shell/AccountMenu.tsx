"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MOCK_USER } from "@/lib/mock-data";

/**
 * Compact account control for the studio bar.
 * Mock only — menu items route to existing pages.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="acct" ref={rootRef}>
      <button
        type="button"
        className={`acct-trigger${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acct-name">{MOCK_USER.name.split(" ")[0]}</span>
        <span className="acct-avatar" aria-hidden="true">
          {MOCK_USER.initials}
        </span>
      </button>

      {open && (
        <div className="acct-menu" role="menu" id={menuId}>
          <div className="acct-menu-head">
            <p className="acct-menu-name">{MOCK_USER.name}</p>
            <p className="acct-menu-email">{MOCK_USER.email}</p>
          </div>
          <div className="acct-menu-sep" role="separator" />
          <Link
            href="/dashboard"
            role="menuitem"
            className="acct-item"
            onClick={() => setOpen(false)}
          >
            All projects
          </Link>
          <Link
            href="/"
            role="menuitem"
            className="acct-item"
            onClick={() => setOpen(false)}
          >
            Marketing site
          </Link>
          <div className="acct-menu-sep" role="separator" />
          <Link
            href="/login"
            role="menuitem"
            className="acct-item acct-item--muted"
            onClick={() => setOpen(false)}
          >
            Sign out
          </Link>
        </div>
      )}
    </div>
  );
}
