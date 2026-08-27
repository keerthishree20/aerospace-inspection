"use client";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Inspect",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 2.25H7.5A2.25 2.25 0 0 0 5.25 4.5v15A2.25 2.25 0 0 0 7.5 21.75h9a2.25 2.25 0 0 0 2.25-2.25v-15A2.25 2.25 0 0 0 16.5 2.25H15M9 2.25v2.25h6V2.25M9 2.25h6M9 13.5h6M9 17.25h3" />
      </svg>
    ),
  },
  {
    href: "/batch",
    label: "Batch",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 6.75v10.5A2.25 2.25 0 0 0 6 19.5h12a2.25 2.25 0 0 0 2.25-2.25V6.75M3.75 6.75 6 3.75h12l2.25 3M9 11.25h6" />
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "Compare",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21V3m0 18-3-3m3 3 3-3M16.5 3v18m0-18 3 3m-3-3-3 3" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-9-9c2.52 0 4.93 1.06 6.61 2.93M21 4.5v4.5h-4.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5h4.5v6.75h-4.5zM9.75 8.25h4.5v12h-4.5zM15.75 3.75h4.5v16.5h-4.5z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-60 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 16l4-1 5-5-7-7 2-2 7 7 5-5 1 2-5 5-1 7-2 2-1-5-5 5-2-2 5-5z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-white tracking-wide">AeroInspect</p>
          <p className="text-[11px] text-slate-500">Edge AI Inspection</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-500/10 text-cyan-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 mx-3 mb-4 rounded-lg bg-slate-800/50 border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <p className="text-xs font-medium text-slate-300">YOLOv8 Model Active</p>
        </div>
        <p className="text-[11px] text-slate-500">Local inference · No API calls</p>
      </div>
    </aside>
  );
}
