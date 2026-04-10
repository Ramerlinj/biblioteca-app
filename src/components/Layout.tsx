import { Link, useLocation } from "wouter";
import {
  PlusCircle,
  LayoutDashboard,
  Users,
  User,
  LogOut,
  Sun,
  Moon,
  Library,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/store";
import Analityts from "@/components/Analityts";

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}> = [
  { href: "/", label: "Biblioteca", icon: Library },
  {
    href: "/books/new",
    label: "Añadir libro",
    icon: PlusCircle,
    roles: ["admin", "superadmin"],
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: Users,
    roles: ["admin", "superadmin"],
  },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Perfil", icon: User },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const currentRole = user?.role ?? "usuario";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar shadow-sm">
        <div className="px-6 py-8">
          <div className="flex items-center gap-2.5">
            <img
              src="/POMARAY_LOGO.webp"
              alt="POMARAY"
              className="h-5 w-5 object-contain"
            />
            <div>
              <h1 className="font-serif text-lg font-semibold text-sidebar-foreground leading-tight">
                Biblioteca
              </h1>
              <p className="text-xs text-muted-foreground">POMARAY</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(currentRole))
            .map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/" ? location === "/" : location.startsWith(href);
              return (
                <Link key={href} href={href}>
                  <span
                    data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </span>
                </Link>
              );
            })}
        </nav>

        <div className="px-3 pb-6 space-y-1 border-t border-sidebar-border pt-4 mt-4">
          <button
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 shrink-0" />
            ) : (
              <Sun className="h-4 w-4 shrink-0" />
            )}
            {theme === "light" ? "Modo oscuro" : "Modo claro"}
          </button>
          <button
            onClick={() => void logout()}
            data-testid="button-logout"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
