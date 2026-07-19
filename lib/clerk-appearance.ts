import type { Appearance } from "@clerk/ui";
import { shadcn } from "@clerk/ui/themes";

/**
 * Clerk starts from its shadcn theme, then picks up the atelier's paper,
 * typography, and vermillion thread so hosted auth never feels bolted on.
 */
export const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "none",
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "#d6452f",
    colorPrimaryForeground: "#f7f3eb",
    colorDanger: "#b42318",
    colorNeutral: "#141210",
    colorForeground: "#141210",
    colorMuted: "#e6e0d4",
    colorMutedForeground: "#7a7268",
    colorBackground: "#f7f3eb",
    colorInput: "#f7f3eb",
    colorInputForeground: "#141210",
    colorRing: "rgba(214, 69, 47, 0.28)",
    colorBorder: "rgba(20, 18, 16, 0.18)",
    colorModalBackdrop: "rgba(20, 18, 16, 0.55)",
    colorShadow: "#141210",
    fontFamily: '"Figtree", system-ui, sans-serif',
    fontFamilyButtons: '"Figtree", system-ui, sans-serif',
    fontFamilyMono: '"JetBrains Mono", ui-monospace, monospace',
    borderRadius: "0.75rem",
    spacing: "1rem",
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      boxShadow: "none",
    },
    card: {
      width: "100%",
      border: "1px solid rgba(20, 18, 16, 0.12)",
      borderRadius: "1.25rem",
      backgroundColor: "#f7f3eb",
      boxShadow:
        "0 8px 40px -12px rgba(20, 18, 16, 0.28)",
    },
    headerTitle: {
      fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
      fontSize: "1.65rem",
      fontWeight: 600,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
    },
    headerSubtitle: {
      color: "#3d3832",
      fontSize: "0.95rem",
      lineHeight: 1.5,
    },
    socialButtonsBlockButton: {
      minHeight: "2.75rem",
      borderColor: "rgba(20, 18, 16, 0.22)",
      borderRadius: "999px",
      backgroundColor: "#f7f3eb",
      color: "#141210",
      fontWeight: 600,
      boxShadow: "none",
    },
    dividerLine: {
      backgroundColor: "rgba(20, 18, 16, 0.12)",
    },
    dividerText: {
      color: "#7a7268",
    },
    formFieldLabel: {
      color: "#3d3832",
      fontSize: "0.78rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
    formFieldInput: {
      minHeight: "2.75rem",
      borderColor: "rgba(20, 18, 16, 0.22)",
      borderRadius: "0.375rem",
      backgroundColor: "#f7f3eb",
      color: "#141210",
      boxShadow: "none",
    },
    formButtonPrimary: {
      minHeight: "2.875rem",
      borderRadius: "999px",
      backgroundColor: "#d6452f",
      color: "#f7f3eb",
      fontWeight: 650,
      letterSpacing: "-0.01em",
      boxShadow: "none",
    },
    footer: {
      backgroundColor: "#f7f3eb",
    },
    footerActionText: {
      color: "#3d3832",
    },
    footerActionLink: {
      color: "#a83422",
      fontWeight: 600,
      textUnderlineOffset: "2px",
    },
    userButtonTrigger: {
      minHeight: "2.25rem",
      gap: "0.55rem",
      padding: "0.2rem 0.35rem 0.2rem 0.75rem",
      border: "1px solid rgba(20, 18, 16, 0.22)",
      borderRadius: "999px",
      backgroundColor: "#f7f3eb",
      color: "#141210",
      boxShadow: "none",
    },
    userButtonOuterIdentifier: {
      color: "#141210",
      fontSize: "0.8125rem",
      fontWeight: 550,
      letterSpacing: "-0.01em",
    },
    userButtonAvatarBox: {
      width: "1.625rem",
      height: "1.625rem",
      backgroundColor: "#141210",
    },
    userButtonPopoverCard: {
      border: "1px solid rgba(20, 18, 16, 0.22)",
      borderRadius: "0.75rem",
      backgroundColor: "#f7f3eb",
      boxShadow:
        "0 8px 40px -12px rgba(20, 18, 16, 0.28)",
    },
    userButtonPopoverActionButton: {
      color: "#3d3832",
      borderRadius: "0.5rem",
      fontWeight: 500,
    },
  },
} satisfies Appearance;
