"use client";

import { useMemo, useState } from "react";
import { ChevronRight, CircleDot, ListOrdered, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACTOR_TYPE_ORDER, actorTypeLabel, type ActorType } from "@/lib/labels";
import type { ActorSummary } from "../data";

// Notion-inspired table for the project's actors, grouped by Cockburn role
// (주요 → 지원 → 배후) the same way the use-case table groups by goal level:
// one collapsible group per role, with the role carried by the group header
// rather than a column. Each row surfaces the actor's kind (사람/시스템) and how
// many use cases it drives as the primary actor.

const TD_BASE =
  "px-3 py-2.5 align-middle first:pl-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border/50";

const HIDE_ON_MOBILE = "hidden md:table-cell";

const COLUMN_COUNT = 3;

function Th({
  icon: Icon,
  children,
  className
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4",
        "border-b border-border [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border/50",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {children}
      </span>
    </th>
  );
}

function groupByType(actors: ActorSummary[]): Array<[string, ActorSummary[]]> {
  const byType = new Map<string, ActorSummary[]>();
  for (const actor of actors) {
    const key = actor.type.toUpperCase();
    const bucket = byType.get(key);
    if (bucket) {
      bucket.push(actor);
    } else {
      byType.set(key, [actor]);
    }
  }

  const orderedKeys = [
    ...ACTOR_TYPE_ORDER.filter((type) => byType.has(type)),
    ...[...byType.keys()].filter((key) => !ACTOR_TYPE_ORDER.includes(key as ActorType))
  ];

  return orderedKeys.map((key) => [key, byType.get(key)!]);
}

function ActorRow({
  actor,
  usecaseCount
}: {
  actor: ActorSummary;
  usecaseCount: number;
}) {
  return (
    <tr className="border-t border-border transition-colors hover:bg-muted/40">
      <td className={cn(TD_BASE, "min-w-[14rem] text-foreground first:pl-8")}>
        <span className="inline-flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback className="bg-tint-gray text-foreground/70">
              {actor.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{actor.name}</span>
        </span>
      </td>
      <td className={TD_BASE}>
        <Badge variant="outline">{actor.is_human ? "사람" : "시스템"}</Badge>
      </td>
      <td className={cn(TD_BASE, HIDE_ON_MOBILE, "tabular-nums")}>
        <span
          className={usecaseCount > 0 ? "text-foreground" : "text-muted-foreground"}
        >
          {usecaseCount}
        </span>
      </td>
    </tr>
  );
}

export function ActorTable({
  actors,
  usecaseCountByActor
}: {
  actors: ActorSummary[];
  usecaseCountByActor: Record<string, number>;
}) {
  // ⚡ Bolt: Memoize the grouped actors to prevent unnecessary grouping work
  // and object creation on every toggle render.
  const groups = useMemo(() => groupByType(actors), [actors]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  function toggle(type: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th icon={User}>액터</Th>
            <Th icon={CircleDot}>유형</Th>
            <Th icon={ListOrdered} className={HIDE_ON_MOBILE}>
              담당 유스케이스
            </Th>
          </tr>
        </thead>
        {actors.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={COLUMN_COUNT}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                액터가 아직 없습니다.
              </td>
            </tr>
          </tbody>
        ) : (
          groups.map(([type, items]) => {
            const isOpen = !collapsed.has(type);
            return (
              <tbody key={type}>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={COLUMN_COUNT} className="py-1.5 pr-3 pl-4">
                    <button
                      type="button"
                      onClick={() => toggle(type)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90"
                        )}
                      />
                      <span className="font-medium text-foreground">
                        {actorTypeLabel(type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {items.length}
                      </span>
                    </button>
                  </td>
                </tr>
                {isOpen &&
                  items.map((actor) => (
                    <ActorRow
                      key={actor.id}
                      actor={actor}
                      usecaseCount={usecaseCountByActor[actor.name] ?? 0}
                    />
                  ))}
              </tbody>
            );
          })
        )}
      </table>
    </div>
  );
}
