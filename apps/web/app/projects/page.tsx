import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSessionCookie } from "../auth";
import { fetchProjects } from "../data";

export default async function ProjectsPage() {
  if (!(await hasSessionCookie())) {
    redirect("/login");
  }

  const projects = await fetchProjects();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Vooster</div>
        <Link href="/login">Account</Link>
      </header>
      <section className="grid">
        <div>
          <div className="eyebrow">Projects</div>
          <h1>Project specs</h1>
        </div>
        <ul className="list">
          {projects.map((project) => (
            <li className="list-item" key={project.key}>
              <Link href={`/projects/${project.key}`}>{project.name}</Link>
              <span className="meta">
                {project.key} · Updated {project.updated_at}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
