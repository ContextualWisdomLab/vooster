import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "../../../../../components/StatusPill";
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
    stakeholder_interests
  } = detail;

  return (
    <article className="grid gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/projects/${key}`}>{key}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ucKey}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <div className="eyebrow">{ucKey}</div>
        <h1>{title}</h1>
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-0 p-0 sm:grid-cols-3 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-1 p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              primary_actor
            </div>
            <div className="text-sm font-semibold text-foreground">
              {primary_actor.name}
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border p-5 sm:border-t-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              level
            </div>
            <div className="text-sm font-semibold text-foreground">{level}</div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border p-5 sm:border-t-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              status
            </div>
            <div>
              <StatusPill status={status} />
            </div>
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-3 rounded-lg bg-tint-mint p-5">
        <h2>main_scenario</h2>
        <div className="border-l-[3px] border-brand pl-3.5">
          {main_scenario.steps.map((step) => (
            <p key={step.step_number}>
              {step.step_number}. {step.actor} {step.action}
            </p>
          ))}
        </div>
      </section>
      <section className="grid gap-2 rounded-lg bg-tint-peach p-5">
        <h2>extensions</h2>
        {extensions.map((extension) => (
          <p key={extension.condition}>
            {extension.condition}: {extension.outcome}
          </p>
        ))}
      </section>
      <section className="grid gap-2 rounded-lg bg-tint-lavender p-5">
        <h2>stakeholder_interests</h2>
        {stakeholder_interests.map((item) => (
          <p key={`${item.stakeholder}-${item.interest}`}>
            {item.stakeholder}: {item.interest}
          </p>
        ))}
      </section>
    </article>
  );
}
