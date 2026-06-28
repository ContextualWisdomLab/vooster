"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  CircleDot,
  GitBranch,
  ListOrdered,
  Type,
  User
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { type Level } from "@/lib/labels";
import type { UsecaseSummary } from "../data";
import { LevelTag } from "./LevelTag";
import { StatusPill } from "./StatusPill";
import { TermLabel } from "./TermLabel";

// Notion-inspired table for the use-case list, grouped by Cockburn goal level.
// The rows are split into collapsible groups (요약 → 사용자 목표 → 하위 기능) so
// the abstraction tiers read as a hierarchy; the grouped property is therefore
// dropped as a column and its color/label is carried by the group header.
// Surface, separators, header tone and tag styling copy Notion's database view;
// the columns are ours. The whole data row is a click target via a stretched
// link on the title cell — the title stays the single focusable link so the
// accessible name is the use-case title.

// Goal level grouping order — highest abstraction first. Levels outside this
// set (degraded/unknown enums) are appended after, so nothing is dropped.
const LEVEL_ORDER: Level[] = ["SUMMARY", "USER_GOAL", "SUBFUNCTION"];

// Tailwind needs literal class strings, so the responsive-hide modifier is
// shared as a constant rather than computed.
const HIDE_ON_MOBILE = "hidden md:table-cell";

const TD_BASE =
  "px-3 py-2.5 align-middle first:pl-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border/50";

const COLUMN_COUNT = 5;

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

function groupByLevel(usecases: UsecaseSummary[]): Array<[string, UsecaseSummary[]]> {
  const byLevel = new Map<string, UsecaseSummary[]>();
  for (const usecase of usecases) {
    const key = usecase.level.toUpperCase();
    const bucket = byLevel.get(key);
    if (bucket) {
      bucket.push(usecase);
    } else {
      byLevel.set(key, [usecase]);
    }
  }

  const orderedKeys = [
    ...LEVEL_ORDER.filter((level) => byLevel.has(level)),
    ...[...byLevel.keys()].filter((key) => !LEVEL_ORDER.includes(key as Level))
  ];

  return orderedKeys.map((key) => [key, byLevel.get(key)!]);
}

function UsecaseRow({
  usecase,
  projectKey
}: {
  usecase: UsecaseSummary;
  projectKey: string;
}) {
  return (
    <tr className="relative border-t border-border transition-colors hover:bg-muted/40">
      <td className={cn(TD_BASE, "min-w-[16rem] first:pl-8")}>
        <Link
          href={`/projects/${projectKey}/usecases/${usecase.key}`}
          className="font-medium text-foreground no-underline after:absolute after:inset-0 hover:underline"
        >
          {usecase.title}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {usecase.key}
        </span>
      </td>
      <td className={TD_BASE}>
        <StatusPill status={usecase.status} />
      </td>
      <td className={cn(TD_BASE, "whitespace-nowrap text-foreground")}>
        <span className="inline-flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback className="bg-tint-gray text-foreground/70">
              {usecase.primary_actor.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {usecase.primary_actor}
        </span>
      </td>
      <td className={cn(TD_BASE, HIDE_ON_MOBILE, "tabular-nums text-muted-foreground")}>
        {usecase.scenario_count}
      </td>
      <td className={cn(TD_BASE, HIDE_ON_MOBILE, "tabular-nums")}>
        <span
          className={
            usecase.extension_count > 0
              ? "font-medium text-warning"
              : "text-muted-foreground"
          }
        >
          {usecase.extension_count}
        </span>
      </td>
    </tr>
  );
}

export function UsecaseTable({
  usecases,
  projectKey
}: {
  usecases: UsecaseSummary[];
  projectKey: string;
}) {
  const groups = useMemo(() => groupByLevel(usecases), [usecases]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  function toggle(level: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th icon={Type}>
              <TermLabel term="usecase" />
            </Th>
            <Th icon={CircleDot}>상태</Th>
            <Th icon={User}>
              <TermLabel term="primary_actor" />
            </Th>
            <Th icon={ListOrdered} className={HIDE_ON_MOBILE}>
              시나리오
            </Th>
            <Th icon={GitBranch} className={HIDE_ON_MOBILE}>
              예외
            </Th>
          </tr>
        </thead>
        {usecases.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={COLUMN_COUNT}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                유스케이스가 아직 없습니다.
              </td>
            </tr>
          </tbody>
        ) : (
          groups.map(([level, items]) => {
            const isOpen = !collapsed.has(level);
            return (
              <tbody key={level}>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={COLUMN_COUNT} className="py-1.5 pr-3 pl-4">
                    <button
                      type="button"
                      onClick={() => toggle(level)}
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
                      <LevelTag level={level} />
                      <span className="text-xs text-muted-foreground">
                        {items.length}
                      </span>
                    </button>
                  </td>
                </tr>
                {isOpen &&
                  items.map((usecase) => (
                    <UsecaseRow
                      key={usecase.key}
                      usecase={usecase}
                      projectKey={projectKey}
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
