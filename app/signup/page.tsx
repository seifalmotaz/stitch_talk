import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Create account — Stitch Talk",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
