import Link from "next/link";
import { StitchMark } from "@/components/chat/Mark";

type LogoProps = {
  href?: string;
  /** Show wordmark next to the mark. */
  showWordmark?: boolean;
  /** Smaller mark for dense chrome. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Shared brand lockup — mark + optional wordmark.
 * Always links home (or dashboard when authenticated contexts pass href).
 */
export function Logo({
  href = "/",
  showWordmark = true,
  size = "md",
  className = "",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={`logo ${size === "sm" ? "logo--sm" : ""} ${className}`.trim()}
      aria-label="Stitch Talk home"
    >
      <span className="logo-mark" aria-hidden="true">
        <StitchMark />
      </span>
      {showWordmark && <span className="logo-word">Stitch Talk</span>}
    </Link>
  );
}
