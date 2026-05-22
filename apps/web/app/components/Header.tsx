import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Vooster home">
        <Image
          src="/logo-text.svg"
          alt="Vooster"
          width={157}
          height={32}
          priority
        />
      </Link>
      {children}
    </header>
  );
}
