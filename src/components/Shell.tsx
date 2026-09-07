"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, LangToggle } from "./I18nProvider";
import NotificationBell from "./NotificationBell";
import { api } from "@/lib/api";
import {
  Bolt, Grid, ScanIcon, Users, List, Tag, Whats, Gear, LogOut, Menu, X,
} from "./Icons";

type Nav = { href: string; key: any; Icon: any; badge?: number };

export default function Shell({
  user,
  children,
}: {
  user: { name: string; username: string; role: string };
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await api.get<{ reminders: any[] }>("/api/reminders");
      if (alive && r.ok) setDueCount(r.reminders.length);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pathname]);

  const nav: Nav[] = [
    { href: "/dashboard", key: "nav_dashboard", Icon: Grid },
    { href: "/scan", key: "nav_scan", Icon: ScanIcon },
    { href: "/members", key: "nav_members", Icon: Users },
    { href: "/checkins", key: "nav_checkins", Icon: List },
    { href: "/reminders", key: "nav_reminders", Icon: Whats, badge: dueCount },
    { href: "/plans", key: "nav_plans", Icon: Tag },
    { href: "/settings", key: "nav_settings", Icon: Gear },
  ];

  const isOn = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const tabs = [
    { href: "/dashboard", key: "nav_dashboard", Icon: Grid },
    { href: "/members", key: "nav_members", Icon: Users },
    { href: "/scan", key: "nav_scan", Icon: ScanIcon, mid: true },
    { href: "/reminders", key: "nav_reminders", Icon: Whats },
    { href: "/settings", key: "nav_settings", Icon: Gear },
  ];

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo">
            <Bolt />
          </div>
          <div className="grow">
            <div className="brandname">
              {lang === "ar" ? <>ثاندر<span>جيم</span></> : <>Thunder<span>Gym</span></>}
            </div>
            <div className="brandsub">{t("tagline")}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            style={{ display: "none" }}
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>

        <nav>
          {nav.map(({ href, key, Icon, badge }) => (
            <Link key={href} href={href} className={`nav-link ${isOn(href) ? "on" : ""}`}>
              <Icon />
              <span className="grow">{t(key)}</span>
              {!!badge && <span className="nav-count num">{badge > 99 ? "99+" : badge}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div
            className="row gap-10"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,.04)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="avatar sm">{initials || "A"}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="fs-13 fw-6 truncate">{user.name}</div>
              <div className="fs-11 t-muted truncate mono">@{user.username}</div>
            </div>
            <button
              className="btn btn-outline btn-sm btn-icon"
              onClick={logout}
              title={t("logout")}
              aria-label={t("logout")}
            >
              <LogOut />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="btn btn-ghost btn-sm btn-icon burger"
            onClick={() => setOpen(true)}
            aria-label="menu"
          >
            <Menu />
          </button>

          <div className="grow row gap-8" style={{ minWidth: 0 }}>
            <span className="fs-13 t-muted truncate hide-sm">
              {t("dash_hello")}, <b style={{ color: "var(--text-2)" }}>{user.name}</b>
            </span>
          </div>

          <LangToggle compact />
          <NotificationBell />
        </header>

        <main className="page">{children}</main>
      </div>

      <nav className="tabbar">
        {tabs.map(({ href, key, Icon, mid }: any) => (
          <Link key={href} href={href} className={`${isOn(href) ? "on" : ""} ${mid ? "mid" : ""}`}>
            <Icon />
            <span>{t(key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
