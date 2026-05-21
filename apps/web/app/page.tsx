import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Vooster</div>
        <Link href="/projects">Projects</Link>
      </header>
      <section className="panel grid">
        <div className="eyebrow">Read-only viewer</div>
        <h1>Review pinned use-case specs</h1>
        <p className="meta">
          Browse projects, inspect Cockburn fields, and hand review context back to CLI-driven
          agents.
        </p>
        <div>
          <Link className="button" href="/projects">
            Open projects
          </Link>
        </div>
      </section>
    </main>
  );
}
