import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { hasSessionCookie } from "../auth";
import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await hasSessionCookie())) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <AppHeader />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
