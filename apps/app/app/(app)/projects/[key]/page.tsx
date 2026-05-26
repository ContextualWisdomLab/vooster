import { ChevronRight, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { visibilityLabel } from "@/lib/labels";
import { UsecaseTable } from "../../../components/UsecaseTable";
import { fetchProject, fetchProjectActors, fetchProjectUsecases } from "../../../data";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [project, usecases, actors] = await Promise.all([
    fetchProject(key),
    fetchProjectUsecases(key),
    fetchProjectActors(key)
  ]);

  const scenarioTotal = usecases.reduce((sum, uc) => sum + uc.scenario_count, 0);
  const extensionTotal = usecases.reduce((sum, uc) => sum + uc.extension_count, 0);

  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <h1>{project?.name ?? key}</h1>
          {project ? (
            <Badge variant="outline">{visibilityLabel(project.visibility)}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          유스케이스 {usecases.length} · 액터 {actors.length} · 시나리오 {scenarioTotal}
        </p>
      </div>
      <Link
        href={`/projects/${key}/actors`}
        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted/40"
      >
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          액터 {actors.length}명
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
          자세히 보기
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      </Link>
      <UsecaseTable usecases={usecases} projectKey={key} />
      {extensionTotal > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-tint-yellow px-4 py-3 text-sm font-medium text-foreground">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          대비된 예외 상황 {extensionTotal}건
        </div>
      ) : null}
    </section>
  );
}
