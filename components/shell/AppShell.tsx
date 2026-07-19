import Link from "next/link";
import { StitchMark } from "@/components/chat/Mark";
import { AccountMenu } from "@/components/shell/AccountMenu";

export type Crumb = {
  label: string;
  href?: string;
};

type AppShellProps = {
  children: React.ReactNode;
  /**
   * Where the user is. Rendered as the main nav content.
   * Last item is the current page (no link).
   * Example: [{ label: "Projects", href: "/dashboard" }, { label: "Aurora" }]
   */
  crumbs?: Crumb[];
  /** Optional right-side actions before account (kept rare). */
  actions?: React.ReactNode;
};

/**
 * Studio orientation bar — not a marketing header, not empty chrome.
 *
 * Jobs it does:
 *  1. Quiet brand mark → always back to projects
 *  2. Breadcrumb path → you know where you are / can go up
 *  3. Account menu → real control, not a dead avatar link
 *
 * Primary page actions (New project, New thread) stay in the page header
 * so this bar never competes for attention.
 */
export function AppShell({
  children,
  crumbs = [{ label: "Projects" }],
  actions,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="studio-bar">
        <div className="studio-bar-inner">
          <div className="studio-bar-main">
            <Link
              href="/dashboard"
              className="studio-mark"
              aria-label="Stitch Talk — all projects"
            >
              <StitchMark />
            </Link>

            <nav className="studio-path" aria-label="Location">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${i}`} className="studio-path-item">
                    {i > 0 && (
                      <span className="studio-path-sep" aria-hidden="true">
                        /
                      </span>
                    )}
                    {crumb.href && !isLast ? (
                      <Link href={crumb.href} className="studio-path-link">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className="studio-path-current"
                        aria-current={isLast ? "page" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          <div className="studio-bar-end">
            {actions}
            <AccountMenu />
          </div>
        </div>
      </header>
      <div className="app-body">{children}</div>
    </div>
  );
}
