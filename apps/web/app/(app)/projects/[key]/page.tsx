import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { levelLabel } from "@/lib/labels";
import { StatusPill } from "../../../components/StatusPill";
import { TermLabel } from "../../../components/TermLabel";
import { fetchProjectActors, fetchProjectUsecases } from "../../../data";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [usecases, actors] = await Promise.all([
    fetchProjectUsecases(key),
    fetchProjectActors(key)
  ]);

  const scenarioTotal = usecases.reduce((sum, uc) => sum + uc.scenario_count, 0);
  const extensionTotal = usecases.reduce((sum, uc) => sum + uc.extension_count, 0);

  return (
    <section className="grid gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{key}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="grid gap-2">
        <div className="eyebrow">Project {key}</div>
        <h1>
          <TermLabel term="usecase" />
        </h1>
        <p className="text-sm text-muted-foreground">
          유스케이스 {usecases.length} · 액터 {actors.length} · 시나리오 {scenarioTotal}
        </p>
      </div>
      <ul className="grid list-none gap-3 p-0">
        {usecases.map((usecase) => (
          <li key={usecase.key}>
            <Card className="gap-2 py-0 transition-colors hover:border-brand/40 hover:bg-muted/40">
              <Link
                href={`/projects/${key}/usecases/${usecase.key}`}
                className="flex flex-col gap-1 p-4 no-underline hover:no-underline"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{usecase.title}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide",
                        usecase.extension_count > 0
                          ? "bg-tint-peach text-warning"
                          : "bg-tint-gray text-muted-foreground"
                      )}
                    >
                      예외 {usecase.extension_count}
                    </span>
                    <StatusPill status={usecase.status} />
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usecase.key} · {levelLabel(usecase.level)} · {usecase.primary_actor}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-tint-peach/60 px-4 py-3 text-sm font-medium text-warning">
        <span aria-hidden="true">⚠</span>
        대비된 예외 상황 {extensionTotal}건
      </div>
    </section>
  );
}
