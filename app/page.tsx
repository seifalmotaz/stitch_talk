import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const STEPS = [
  {
    n: "01",
    title: "Talk it through",
    body: "Describe the product, audience, and feeling. Pin references if you have them.",
  },
  {
    n: "02",
    title: "Find the direction",
    body: "Stitch Talk asks the questions a good design lead would — before pixels exist.",
  },
  {
    n: "03",
    title: "Leave with a brief",
    body: "One paste-ready prompt for Stitch, Figma AI, or whatever you build in next.",
  },
];

/**
 * Marketing landing — simple path into the product.
 * One story, three steps, two CTAs (start / sign in).
 */
export default function LandingPage() {
  return (
    <div className="land">
      <header className="land-nav">
        <Logo />
        <nav className="land-nav-actions" aria-label="Account">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-thread">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="land-hero">
          <p className="land-kicker">
            <span className="land-kicker-line" aria-hidden="true" />
            Design before you generate
          </p>
          <h1 className="land-title">
            Figure out what the UI should <em>feel</em> like — first.
          </h1>
          <p className="land-lead">
            Stitch Talk is a chat atelier for UI and UX designers. Work in
            projects, run design threads, and leave with a brief you can
            actually build from.
          </p>
          <div className="land-cta-row">
            <Link href="/signup" className="btn btn-thread btn-lg">
              Start free
            </Link>
            <Link href="/dashboard" className="btn btn-ghost btn-lg">
              View demo studio
            </Link>
          </div>
          <p className="land-note">No credit card · Mock demo available now</p>
        </section>

        <section className="land-steps" aria-labelledby="how-heading">
          <div className="land-section-head">
            <h2 id="how-heading" className="land-section-title">
              How it works
            </h2>
            <p className="land-section-lead">
              Three moves. No dashboard maze.
            </p>
          </div>
          <ol className="land-step-grid">
            {STEPS.map((s) => (
              <li key={s.n} className="land-step">
                <span className="land-step-n">{s.n}</span>
                <h3 className="land-step-title">{s.title}</h3>
                <p className="land-step-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="land-model" aria-labelledby="model-heading">
          <div className="land-model-card">
            <h2 id="model-heading" className="land-section-title">
              Built like a studio, not a chat dump
            </h2>
            <ul className="land-model-list">
              <li>
                <strong>Projects</strong> hold one product or brand.
              </li>
              <li>
                <strong>Threads</strong> are focused design conversations.
              </li>
              <li>
                <strong>Briefs</strong> are the handoff — not endless chat.
              </li>
            </ul>
            <Link href="/signup" className="btn btn-primary">
              Open your studio
            </Link>
          </div>
        </section>
      </main>

      <footer className="land-footer">
        <Logo size="sm" />
        <p>Design the feel before anything gets generated.</p>
      </footer>
    </div>
  );
}
