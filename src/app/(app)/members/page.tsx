"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { api } from "@/lib/api";
import { Avatar, Empty, Loading, PageHead, StateBadge } from "@/components/ui";
import { Plus, Search, Whats, ChevronL, ChevronR } from "@/components/Icons";
import type { MemberDTO } from "@/lib/queries";

const FILTERS = ["all", "active", "expiring", "expired", "none"] as const;

export default function MembersPage() {
  const { t, dir, fmtDate } = useI18n();
  const [members, setMembers] = useState<MemberDTO[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const r = await api.get<{ members: MemberDTO[] }>(
        `/api/members?search=${encodeURIComponent(search)}&filter=${filter}`
      );
      if (alive && r.ok) setMembers(r.members);
    }, search ? 260 : 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [search, filter]);

  const labels: Record<string, string> = {
    all: t("filter_all"),
    active: t("filter_active"),
    expiring: t("filter_expiring"),
    expired: t("filter_expired"),
    none: t("filter_none"),
  };

  return (
    <>
      <PageHead
        title={t("members_title")}
        sub={t("members_sub")}
        right={
          <Link href="/members/new" className="btn btn-primary">
            <Plus />
            {t("add_member")}
          </Link>
        }
      />

      <div className="row gap-12 wrap" style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
          <Search
            width={17}
            height={17}
            style={{
              position: "absolute",
              insetInlineStart: 13,
              top: 13,
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          />
          <input
            className="input"
            style={{ paddingInlineStart: 40 }}
            placeholder={t("search_ph")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {labels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="card anim-up">
        {!members ? (
          <Loading />
        ) : members.length === 0 ? (
          <Empty text={t("no_members")} />
        ) : (
          <div className="table-wrap">
            <table className="tg">
              <thead>
                <tr>
                  <th>{t("col_member")}</th>
                  <th className="hide-sm">{t("col_plan")}</th>
                  <th>{t("col_left")}</th>
                  <th className="hide-sm">{t("col_end")}</th>
                  <th>{t("col_status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row gap-10">
                        <Avatar name={m.name} gender={m.gender} />
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/members/${m.id}`} className="fw-6 truncate">
                            {m.name}
                          </Link>
                          <div className="fs-11 t-muted mono">
                            {m.serial} · {m.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm fs-13 t-2">{m.sub?.plan ?? "—"}</td>
                    <td>
                      <div style={{ minWidth: 96 }}>
                        <div className="row-b" style={{ marginBottom: 5 }}>
                          <b className="num fs-14">{m.daysLeft}</b>
                          <span className="fs-11 t-muted num">
                            {t("of_days")} {m.totalDays}
                          </span>
                        </div>
                        <div className="bar">
                          <i
                            style={{
                              width: `${m.pct}%`,
                              background:
                                m.state === "active"
                                  ? "var(--ok)"
                                  : m.state === "expiring"
                                  ? "var(--warn)"
                                  : "var(--danger)",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm fs-13 t-2 num">{m.sub ? fmtDate(m.sub.end) : "—"}</td>
                    <td>
                      <StateBadge state={m.state} />
                    </td>
                    <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>
                      <div className="row gap-6" style={{ justifyContent: "flex-end" }}>
                        <a
                          className="btn btn-outline btn-sm btn-icon"
                          href={`https://wa.me/${m.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Whats />
                        </a>
                        <Link className="btn btn-ghost btn-sm btn-icon" href={`/members/${m.id}`}>
                          <Arrow />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {members && members.length > 0 && (
        <p className="fs-12 t-muted center mt-16 num">{members.length}</p>
      )}
    </>
  );
}
