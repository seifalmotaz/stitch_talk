import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Sign in — Stitch Talk",
};

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand">
          <Logo href="/" />
        </div>
        <SignIn />
      </div>
    </main>
  );
}
