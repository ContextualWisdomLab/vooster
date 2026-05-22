import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSessionCookie } from "../../../../auth";
import { Header } from "../../../../components/Header";
import { fetchUsecaseDetail } from "../../../../data";

export default async function UsecasePage({
  params
}: {
  params: Promise<{ key: string; ucKey: string }>;
}) {
  if (!(await hasSessionCookie())) {
    redirect("/login");
  }

  const { key, ucKey } = await params;
  const detail = await fetchUsecaseDetail(key, ucKey);
  const { title, primary_actor, level, status, main_scenario, extensions, stakeholder_interests } =
    detail;

  return (
    <main className="shell">
      <Header>
        <Link href={`/projects/${key}`}>Use cases</Link>
      </Header>
      <article className="grid">
        <div>
          <div className="eyebrow">{ucKey}</div>
          <h1>{title}</h1>
        </div>
        <section className="panel field-grid">
          <div className="field">
            <div className="label">primary_actor</div>
            <div className="value">{primary_actor.name}</div>
          </div>
          <div className="field">
            <div className="label">level</div>
            <div className="value">{level}</div>
          </div>
          <div className="field">
            <div className="label">status</div>
            <div className="value">{status}</div>
          </div>
        </section>
        <section className="panel grid">
          <h2>main_scenario</h2>
          <div className="scenario">
            {main_scenario.steps.map((step) => (
              <p key={step.step_number}>
                {step.step_number}. {step.actor} {step.action}
              </p>
            ))}
          </div>
        </section>
        <section className="panel grid">
          <h2>extensions</h2>
          {extensions.map((extension) => (
            <p key={extension.condition}>
              {extension.condition}: {extension.outcome}
            </p>
          ))}
        </section>
        <section className="panel grid">
          <h2>stakeholder_interests</h2>
          {stakeholder_interests.map((item) => (
            <p key={`${item.stakeholder}-${item.interest}`}>
              {item.stakeholder}: {item.interest}
            </p>
          ))}
        </section>
      </article>
    </main>
  );
}
