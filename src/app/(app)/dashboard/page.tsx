"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { api } from "@/lib/api";
import { Avatar, DaysRing, Loading, Money, PageHead, StateBadge } from "@/components/ui";
import {
  Users, Check, Alert, Clock, ScanIcon, Wallet, Trending, Whats, ChevronL, ChevronR,
} from "@/components/Icons";

type Stats = {
  counts: { active: number; expiring: number; expired: number; none: number; total: number };
  todayCheckins: number;
  revenue: number;
  series: { date: string; count: number }[];
  recent: any[];
  attention: any[];
};

export default function Dashboard() {
  const { t, lang, dir, fmtDateTime } = useI18n();
  const [s, setS] = useState<Stats | null>(null);
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await api.get<Stats>("/api/stats");
      if (alive && r.ok) setS(r as any);
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!s) return <Loading />;

  const cards = [
    { v: s.counts.active, l: t("stat_active"), I: Check, c: "var(--ok)" },
    { v: s.counts.expiring, l: t("stat_expiring"), I: Alert, c: "var(--warn)" },
    { v: s.counts.expired, l: t("stat_expired"), I: Clock, c: "var(--danger)" },
    { v: s.todayCheckins, l: t("stat_today"), I: ScanIcon, c: "var(--gold)" },
    { v: s.counts.total, l: t("stat_members"), I: Users, c: "var(--info)" },
  ];

  const maxBar = Math.max(1, ...s.series.map((x) => x.count));
  const dayNames =
    lang === "ar"
      ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <PageHead
        title={t("nav_dashboard")}
        sub={t("dash_sub")}
        right={
          <Link href="/scan" className="btn btn-primary">
            <ScanIcon />
            {t("nav_scan")}
          </Link>
        }
      />

      {/* stats */}
      <div className="stats">
        {cards.map((c, i) => (
          <div className={`stat anim-up d${i + 1}`} key={i} style={{ color: c.c }}>
            <div
              className="stat-ico"
              style={{ background: "color-mix(in srgb, currentColor 14%, transparent)" }}
            >
              <c.I />
            </div>
            <div className="stat-val num" style={{ color: "var(--text)" }}>
              {c.v}
            </div>
            <div className="stat-lbl">{c.l}</div>
          </div>
        ))}
        <div className="stat anim-up d6" style={{ color: "var(--violet)" }}>
          <div
            className="stat-ico"
            style={{ background: "color-mix(in srgb, currentColor 14%, transparent)" }}
          >
            <Wallet />
          </div>
          <div className="stat-val" style={{ color: "var(--text)", fontSize: 25 }}>
            <Money value={s.revenue} />
          </div>
          <div className="stat-lbl">{t("stat_revenue")}</div>
        </div>
      </div>

      {/* grid */}
      <div
        className="mt-24 dash-grid"
      >
        <div className="col gap-16" style={{ minWidth: 0 }}>
          {/* weekly chart */}
          <div className="card anim-up">
            <div className="card-head">
              <h3>
                <Trending
                  width={15}
                  height={15}
                  style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 6, color: "var(--gold)" }}
                />
                {t("week_activity")}
              </h3>
            </div>
            <div className="card-pad">
              <div className="chart">
                {s.series.map((d) => {
                  const dt = new Date(d.date + "T00:00:00");
                  return (
                    <div className="chart-col" key={d.date} title={`${d.date}: ${d.count}`}>
                      <span className="chart-val num">{d.count || ""}</span>
                      <div className="chart-track">
                        <div
                          className="chart-bar"
                          style={{ height: `${Math.max(4, (d.count / maxBar) * 100)}%` }}
                        />
                      </div>
                      <span className="chart-lbl">{dayNames[dt.getDay()]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* recent check-ins */}
          <div className="card anim-up d2">
            <div className="card-head">
              <h3>{t("recent_checkins")}</h3>
              <Link href="/checkins" className="btn btn-outline btn-sm">
                {t("view_all")}
                <Arrow />
              </Link>
            </div>
            {s.recent.length === 0 ? (
              <div className="empty">{t("no_data")}</div>
            ) : (
              <div className="table-wrap">
                <table className="tg">
                  <tbody>
                    {s.recent.map((c) => (
                      <tr key={c.id}>
                        <td style={{ width: 46 }}>
                          <Avatar name={c.full_name} gender={c.gender} size="sm" />
                        </td>
                        <td>
                          <Link href={`/members/${c.member_id}`} className="fw-6">
                            {c.full_name}
                          </Link>
                          <div className="fs-11 t-muted mono">{c.serial}</div>
                        </td>
                        <td className="hide-sm">
                          {c.result === "granted" ? (
                            <span className="badge b-active">{t("res_granted")}</span>
                          ) : (
                            <span className="badge b-expired">{t("res_denied")}</span>
                          )}
                        </td>
                        <td className="fs-12 t-muted num" style={{ textAlign: "end" }}>
                          {fmtDateTime(c.scanned_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* attention */}
        <div className="card anim-up d3">
          <div className="card-head">
            <h3>
              <Alert
                width={15}
                height={15}
                style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 6, color: "var(--warn)" }}
              />
              {t("attention")}
            </h3>
            <Link href="/reminders" className="btn btn-outline btn-sm">
              <Whats />
            </Link>
          </div>

          {s.attention.length === 0 ? (
            <div className="empty">{t("rem_none")}</div>
          ) : (
            <div className="col">
              {s.attention.map((m: any) => (
                <Link
                  href={`/members/${m.id}`}
                  key={m.id}
                  className="row gap-12"
                  style={{ padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,.045)" }}
                >
                  <Avatar name={m.name} gender={m.gender} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="fs-14 fw-6 truncate">{m.name}</div>
                    <div className="fs-11 t-muted mono">{m.serial}</div>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <div
                      className="num fw-7"
                      style={{
                        fontSize: 17,
                        color: m.daysLeft <= 0 ? "var(--danger)" : "var(--warn)",
                      }}
                    >
                      {m.daysLeft}
                    </div>
                    <div className="fs-11 t-muted">{t("days")}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
