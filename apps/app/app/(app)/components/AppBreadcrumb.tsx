"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

type Crumb = { label: string; href: string };

/**
 * Derives the breadcrumb trail from the current route. Labels are the raw URL
 * segments (project / use-case keys), matching what the pages displayed before
 * the breadcrumb moved into the header. Returns `[]` for routes without a
 * trail (e.g. the home page), so the header renders nothing.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const [root, key, group, ucKey] = pathname.split("/").filter(Boolean);
  if (root !== "projects" || !key) {
    return [];
  }

  const crumbs: Crumb[] = [
    { label: "Projects", href: "/" },
    { label: key, href: `/projects/${key}` }
  ];
  if (group === "usecases" && ucKey) {
    crumbs.push({ label: ucKey, href: `/projects/${key}/usecases/${ucKey}` });
  }
  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <>
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
