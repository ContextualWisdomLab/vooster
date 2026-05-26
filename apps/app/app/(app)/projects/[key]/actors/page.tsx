import { ActorTable } from "../../../../components/ActorTable";
import {
  fetchProject,
  fetchProjectActors,
  fetchProjectUsecases
} from "../../../../data";

export default async function ProjectActorsPage({
  params
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const [project, actors, usecases] = await Promise.all([
    fetchProject(key),
    fetchProjectActors(key),
    fetchProjectUsecases(key)
  ]);

  // How many use cases each actor drives as the primary actor. Matched by name,
  // which is how a use-case summary names its primary actor.
  const usecaseCountByActor: Record<string, number> = {};
  for (const usecase of usecases) {
    usecaseCountByActor[usecase.primary_actor] =
      (usecaseCountByActor[usecase.primary_actor] ?? 0) + 1;
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h1>액터</h1>
        <p className="text-sm text-muted-foreground">
          {project?.name ?? key} · 총 {actors.length}명
        </p>
      </div>
      <ActorTable actors={actors} usecaseCountByActor={usecaseCountByActor} />
    </section>
  );
}
