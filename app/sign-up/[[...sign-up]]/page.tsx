import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Create account — Stitch Talk",
};

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-brand">
          <Logo href="/" />
        </div>
        <SignUp />
      </div>
    </main>
  );
}
