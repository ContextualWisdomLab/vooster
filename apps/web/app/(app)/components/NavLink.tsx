"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

export function NavLink({ href, children, icon, disabled }: NavLinkProps) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const classes = [
    "nav-link",
    active ? "nav-link--active" : "",
    disabled ? "nav-link--disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {icon ? <span className="nav-link__icon">{icon}</span> : null}
      <span className="nav-link__label">{children}</span>
    </>
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
