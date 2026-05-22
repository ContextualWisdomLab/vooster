import {
  ChevronsLeft,
  FolderClosed,
  HelpCircle,
  Home,
  LifeBuoy,
  Search,
  Settings
} from "lucide-react";
import Image from "next/image";
import { fetchProjects } from "../../data";
import { NavLink } from "./NavLink";

export async function Sidebar() {
  const projects = await fetchProjects();

  return (
    <aside className="sidebar">
      <div className="sidebar__workspace">
        <Image
          src="/logo.png"
          alt=""
          width={24}
          height={24}
          className="sidebar__logo"
          priority
        />
        <div className="sidebar__workspace-name">Vooster</div>
        <button
          type="button"
          className="sidebar__collapse"
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft size={16} strokeWidth={1.75} />
        </button>
      </div>

      <nav className="sidebar__group">
        <NavLink href="/" icon={<Home size={16} strokeWidth={1.75} />}>
          Home
        </NavLink>
        <NavLink
          href="/search"
          icon={<Search size={16} strokeWidth={1.75} />}
          disabled
        >
          Search
        </NavLink>
        <NavLink
          href="/settings"
          icon={<Settings size={16} strokeWidth={1.75} />}
          disabled
        >
          Settings
        </NavLink>
      </nav>

      <div className="sidebar__group">
        <div className="sidebar__heading">Projects</div>
        {projects.length === 0 ? (
          <div className="sidebar__empty">No projects yet</div>
        ) : (
          projects.map((project) => (
            <NavLink
              key={project.id}
              href={`/projects/${project.id}`}
              icon={<FolderClosed size={16} strokeWidth={1.75} />}
            >
              {project.name}
            </NavLink>
          ))
        )}
      </div>

      <div className="sidebar__group sidebar__group--footer">
        <div className="sidebar__heading">Help</div>
        <NavLink
          href="/help"
          icon={<LifeBuoy size={16} strokeWidth={1.75} />}
          disabled
        >
          Help center
        </NavLink>
        <NavLink
          href="/contact"
          icon={<HelpCircle size={16} strokeWidth={1.75} />}
          disabled
        >
          Contact support
        </NavLink>
      </div>
    </aside>
  );
}
