import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { levelLabel, STATUS_TERM_LABEL } from "@/lib/labels";
import { StatusPill } from "../../../../../components/StatusPill";
import { TermLabel } from "../../../../../components/TermLabel";
import { fetchUsecaseDetail } from "../../../../../data";

export default async function UsecasePage({
  params
}: {
  params: Promise<{ key: string; ucKey: string }>;
}) {
  const { key, ucKey } = await params;
  const detail = await fetchUsecaseDetail(key, ucKey);
  const {
    title,
    primary_actor,
    level,
    status,
    main_scenario,
    extensions,
    stakeholder_interests,
    invoked_by
  } = detail;

  return (
    <article className="grid gap-6">
      <div>
        <div className="eyebrow">{ucKey}</div>
        <h1>{title}</h1>
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-0 p-0 sm:grid-cols-3 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-1 p-5">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              <TermLabel term="primary_actor" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {primary_actor.name}
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border p-5 sm:border-t-0">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              <TermLabel term="level" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {levelLabel(level)}
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border p-5 sm:border-t-0">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              {STATUS_TERM_LABEL}
            </div>
            <div>
              <StatusPill status={status} />
            </div>
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-3 rounded-lg border border-border bg-muted/40 p-5">
        <h2>
          <TermLabel term="main_scenario" />
        </h2>
        <div className="grid gap-1.5 border-l-[3px] border-foreground/20 pl-3.5">
          {main_scenario.steps.map((step) => (
            <div key={step.step_number}>
              <p>
                {step.step_number}. {step.actor} {step.action}
              </p>
              {step.invokes && step.invokes.length > 0 ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium">호출</span>
                  {step.invokes.map((target) => (
                    <Link
                      key={target}
                      href={`/projects/${key}/usecases/${target}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {target}
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-2 rounded-lg border border-border bg-muted/40 p-5">
        <h2>
          <TermLabel term="extensions" />
        </h2>
        {extensions.map((extension) => (
          <p key={extension.condition}>
            {extension.condition}: {extension.outcome}
          </p>
        ))}
      </section>
      <section className="grid gap-2 rounded-lg border border-border bg-muted/40 p-5">
        <h2>
          <TermLabel term="stakeholder_interests" />
        </h2>
        {stakeholder_interests.map((item) => (
          <p key={`${item.stakeholder}-${item.interest}`}>
            {item.stakeholder}: {item.interest}
          </p>
        ))}
      </section>
      {invoked_by && invoked_by.length > 0 ? (
        <section className="grid gap-2 rounded-lg border border-border bg-muted/40 p-5">
          <h2>호출됨</h2>
          {invoked_by.map((caller) => (
            <p key={`${caller.key}-${caller.step_number}`}>
              <Link
                href={`/projects/${key}/usecases/${caller.key}`}
                className="font-medium text-foreground hover:underline"
              >
                {caller.key}
              </Link>{" "}
              {caller.title} ({caller.step_number}단계)
            </p>
          ))}
        </section>
      ) : null}
    </article>
  );
}
