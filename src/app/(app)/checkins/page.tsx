"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { api } from "@/lib/api";
import { Avatar, Empty, Loading, PageHead } from "@/components/ui";
import { Refresh } from "@/components/Icons";

type Row = {
  id: number;
  scanned_at: string;
  result: string;
  days_left: number | null;
  source: string;
  member_id: number;
  full_name: string;
  serial: string;
  gender: "male" | "female";
  phone: string;
};

export default function CheckinsPage() {
  const { t, fmtDateTime } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [only, setOnly] = useState<"all" | "granted" | "denied">("all");
  const [today, setToday] = useState(0);

  async function load() {
    const r = await api.get<{ checkins: Row[]; todayCount: number }>(
      `/api/checkins?limit=200${only === "all" ? "" : `&only=${only}`}`
    );
    if (r.ok) {
      setRows(r.checkins);
      setToday(r.todayCount);
    }
  }

  useEffect(() => {
    setRows(null);
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only]);

  return (
    <>
      <PageHead
        title={t("checkins_title")}
        sub={t("checkins_sub")}
        right={
          <>
            <span className="badge b-active plain">
              {t("stat_today")}: <b className="num">{today}</b>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={load}>
              <Refresh />
            </button>
          </>
        }
      />

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={only === "all" ? "on" : ""} onClick={() => setOnly("all")}>
          {t("filter_all")}
        </button>
        <button className={only === "granted" ? "on" : ""} onClick={() => setOnly("granted")}>
          {t("res_granted")}
        </button>
        <button className={only === "denied" ? "on" : ""} onClick={() => setOnly("denied")}>
          {t("res_denied")}
        </button>
      </div>

      <div className="card anim-up">
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text={t("no_data")} />
        ) : (
          <div className="table-wrap">
            <table className="tg">
              <thead>
                <tr>
                  <th>{t("col_member")}</th>
                  <th>{t("col_result")}</th>
                  <th className="hide-sm">{t("col_left")}</th>
                  <th style={{ textAlign: "end" }}>{t("col_time")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="row gap-10">
                        <Avatar name={c.full_name} gender={c.gender} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/members/${c.member_id}`} className="fw-6 fs-13 truncate">
                            {c.full_name}
                          </Link>
                          <div className="fs-11 t-muted mono">{c.serial}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.result === "granted" ? "b-active" : "b-expired"}`}>
                        {c.result === "granted" ? t("res_granted") : t("res_denied")}
                      </span>
                    </td>
                    <td className="hide-sm num fs-13 t-2">
                      {c.result === "granted" ? `${c.days_left ?? 0} ${t("days")}` : "—"}
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
    </>
  );
}
