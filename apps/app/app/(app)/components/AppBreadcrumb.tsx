"use client";

import Image from "next/image";
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
import { useSidebar } from "@/components/ui/sidebar";

type Crumb = { label: string; href: string };

/**
 * Derives the breadcrumb trail from the current route, excluding the home root.
 * Labels are the raw URL segments (project / use-case keys). Returns `[]` on the
 * home page.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const [root, key, group, ucKey] = pathname.split("/").filter(Boolean);
  if (root !== "projects" || !key) {
    return [];
  }

  const crumbs: Crumb[] = [{ label: key, href: `/projects/${key}` }];
  if (group === "usecases" && ucKey) {
    crumbs.push({ label: ucKey, href: `/projects/${key}/usecases/${ucKey}` });
  }
  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const crumbs = buildCrumbs(pathname);

  // When the sidebar is expanded it already shows the logo; the breadcrumb only
  // carries the leading home logo once the sidebar is collapsed (hidden).
  const showLogo = state === "collapsed";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showLogo && (
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" aria-label="Vooster 홈" className="hover:no-underline">
                <Image
                  src="/logo.png"
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 max-w-none shrink-0 rounded-sm"
                  priority
                />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        )}
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const showSeparator = showLogo || index > 0;
          return (
            <Fragment key={crumb.href}>
              {showSeparator && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
