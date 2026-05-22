import Link from "next/link";
import { fetchProjects } from "../data";

export default async function HomePage() {
  const projects = await fetchProjects();

  return (
    <section className="grid">
      <div>
        <div className="eyebrow">Projects</div>
        <h1>Project specs</h1>
      </div>
      <ul className="list">
        {projects.map((project) => (
          <li className="list-item" key={project.id}>
            <Link href={`/projects/${project.id}`}>{project.name}</Link>
            <span className="meta">
              {project.key} · {project.visibility}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
