import Image from "next/image";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header">
      <Link href="/" className="brand" aria-label="Vooster home">
        <Image src="/logo-text.svg" alt="Vooster" width={118} height={24} priority />
      </Link>
      <div className="app-header__actions">
        <Link className="app-header__link" href="/login">
          Account
        </Link>
      </div>
    </header>
  );
}
