import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-brand" style={{ display: "flex", justifyContent: "center" }}>
          <Logo href="/" />
        </div>
        <h1 className="auth-title">Page not found</h1>
        <p className="auth-lead">
          That thread or project doesn&rsquo;t exist in this demo.
        </p>
        <div className="land-cta-row" style={{ justifyContent: "center" }}>
          <Link href="/dashboard" className="btn btn-thread">
            Back to projects
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
