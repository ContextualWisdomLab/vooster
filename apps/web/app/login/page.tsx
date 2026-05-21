export default function LoginPage() {
  const loginPath = "/v1/auth/github/start";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Vooster</div>
      </header>
      <section className="panel grid">
        <div className="eyebrow">Authentication</div>
        <h1>Sign in to review specs</h1>
        <p className="meta">Use the existing GitHub session flow shared with the API.</p>
        <div>
          <a className="button" href={loginPath}>
            Continue with GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
