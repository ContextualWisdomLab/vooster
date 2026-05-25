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
import { levelLabel } from "@/lib/labels";
import { StatusPill } from "../../../components/StatusPill";
import { TermLabel } from "../../../components/TermLabel";
import { fetchProjectUsecases } from "../../../data";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const usecases = await fetchProjectUsecases(key);

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
      <div>
        <div className="eyebrow">Project {key}</div>
        <h1>
          <TermLabel term="usecase" />
        </h1>
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
                  <StatusPill status={usecase.status} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {usecase.key} · {levelLabel(usecase.level)} · {usecase.primary_actor}
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
