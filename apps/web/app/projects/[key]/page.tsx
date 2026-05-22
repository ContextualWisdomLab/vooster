import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSessionCookie } from "../../auth";
import { Header } from "../../components/Header";
import { StatusPill } from "../../components/StatusPill";
import { fetchProjectUsecases } from "../../data";

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  if (!(await hasSessionCookie())) {
    redirect("/login");
  }

  const { key } = await params;
  const usecases = await fetchProjectUsecases(key);

  return (
    <main className="shell">
      <Header>
        <Link href="/">Projects</Link>
      </Header>
      <section className="grid">
        <div>
          <div className="eyebrow">Project {key}</div>
          <h1>Use cases</h1>
        </div>
        <ul className="list">
          {usecases.map((usecase) => (
            <li className="list-item" key={usecase.key}>
              <div className="flex items-center justify-between gap-3">
                <Link href={`/projects/${key}/usecases/${usecase.key}`}>{usecase.title}</Link>
                <StatusPill status={usecase.status} />
              </div>
              <span className="meta">
                {usecase.key} · {usecase.level} · {usecase.primary_actor}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
