import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  HandHeart,
  Boxes,
  Settings as SettingsIcon,
  LogOut,
  Tent,
  Menu,
  X,
  UserRoundSearch,
  Layers,
} from "lucide-react";

const navItems = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, end: true },
  { to: "/families", label: "العائلات", icon: Users },
  { to: "/individual-members", label: "أفراد مفصّل", icon: UserRoundSearch },
  { to: "/categories", label: "الفئات الخاصة", icon: Layers },
  { to: "/aid-records", label: "سجل المساعدات", icon: HandHeart },
  { to: "/aid-types", label: "أنواع المساعدات", icon: Boxes, adminOnly: true },
  { to: "/settings", label: "الإعدادات", icon: SettingsIcon, adminOnly: true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const items = navItems.filter((i) => !i.adminOnly || isAdmin);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-100">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-600/30">
          <Tent className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-cairo font-extrabold text-slate-900 leading-tight">مخيم العائدين</div>
          <div className="text-xs text-slate-400 font-tajawal">إدارة المساعدات</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            data-testid={`nav-${item.to === "/" ? "dashboard" : item.to.slice(1)}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl font-tajawal font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-l from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold font-cairo shrink-0">
            {user?.name?.[0] || "م"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-tajawal font-bold text-slate-800 truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 font-tajawal">{isAdmin ? "مدير" : "موظف"}</div>
          </div>
        </div>
        <button
          onClick={logout}
          data-testid="logout-button"
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-tajawal font-semibold text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 glass-card border-y-0 border-s-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 end-0 w-72 bg-white shadow-2xl animate-fade-up">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden glass-card border-x-0 border-t-0 sticky top-0 z-30 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Tent className="w-5 h-5 text-white" />
            </div>
            <span className="font-cairo font-bold text-slate-900">مخيم العائدين</span>
          </div>
          <button onClick={() => setOpen(!open)} data-testid="mobile-menu-button" className="p-2 rounded-lg hover:bg-slate-100">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
