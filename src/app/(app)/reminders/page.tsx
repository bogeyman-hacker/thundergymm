"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Avatar, Empty, Loading, PageHead } from "@/components/ui";
import { Whats, Check, Refresh, Alert } from "@/components/Icons";

type Rem = {
  memberId: number;
  subscriptionId: number;
  name: string;
  serial: string;
  phone: string;
  gender: "male" | "female";
  plan: string;
  endDate: string;
  daysLeft: number;
  totalDays: number;
  kind: "mid" | "end" | "expired";
  text: string;
  link: string;
};

export default function RemindersPage() {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState<Rem[] | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    const r = await api.get<{ reminders: Rem[]; adminDigestLink: string | null }>("/api/reminders");
    if (r.ok) {
      setItems(r.reminders);
      setDigest(r.adminDigestLink);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function mark(x: Rem) {
    const r = await api.post("/api/reminders", {
      subscriptionId: x.subscriptionId,
      memberId: x.memberId,
      kind: x.kind,
      text: x.text,
      phone: x.phone,
    });
    if (r.ok) {
      setDone((p) => ({ ...p, [x.subscriptionId]: true }));
      toast(t("marked"));
    } else toast(r.error, "err");
  }

  const kindLabel = (k: Rem["kind"]) =>
    k === "mid" ? t("rem_mid") : k === "expired" ? t("rem_expired") : t("rem_end");
  const kindClass = (k: Rem["kind"]) =>
    k === "mid" ? "b-frozen" : k === "expired" ? "b-expired" : "b-expiring";

  return (
    <>
      <PageHead
        title={t("rem_title")}
        sub={t("rem_sub")}
        right={
          <>
            {digest && (
              <a className="btn btn-ghost btn-sm" href={digest} target="_blank" rel="noreferrer">
                <Whats />
                {t("notify_me")}
              </a>
            )}
            <button className="btn btn-outline btn-sm" onClick={load}>
              <Refresh />
            </button>
          </>
        }
      />

      <div
        className="fs-13 t-2"
        style={{
          padding: "11px 14px",
          borderRadius: 10,
          background: "rgba(37,211,102,.07)",
          border: "1px solid rgba(37,211,102,.22)",
          marginBottom: 16,
        }}
      >
        <Whats
          width={15}
          height={15}
          style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 7, color: "#25D366" }}
        />
        {t("send_all_note")}
      </div>

      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card">
          <Empty text={t("rem_none")} />
        </div>
      ) : (
        <div className="col gap-12">
          {items.map((x, i) => {
            const sent = done[x.subscriptionId];
            return (
              <div
                key={x.subscriptionId}
                className={`card card-pad anim-up d${(i % 6) + 1}`}
                style={{ opacity: sent ? 0.55 : 1 }}
              >
                <div className="row-b wrap gap-12">
                  <div className="row gap-12" style={{ minWidth: 0 }}>
                    <Avatar name={x.name} gender={x.gender} />
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/members/${x.memberId}`} className="fw-6 truncate">
                        {x.name}
                      </Link>
                      <div className="fs-11 t-muted mono">
                        {x.serial} · {x.phone}
                      </div>
                    </div>
                  </div>

                  <div className="row gap-10 wrap">
                    <span className={`badge ${kindClass(x.kind)}`}>{kindLabel(x.kind)}</span>
                    <div style={{ textAlign: "center", minWidth: 64, whiteSpace: "nowrap" }}>
                      <div
                        className="num fw-7 fs-18"
                        style={{ color: x.daysLeft <= 0 ? "var(--danger)" : "var(--warn)" }}
                      >
                        {x.daysLeft}
                      </div>
                      <div className="fs-11 t-muted">{t("days")}</div>
                    </div>
                    <a
                      className="btn btn-wa btn-sm"
                      href={x.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setTimeout(() => mark(x), 400)}
                    >
                      <Whats />
                      {t("open_wa")}
                    </a>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => mark(x)}
                      disabled={sent}
                    >
                      <Check />
                      {sent ? t("marked") : t("mark_sent")}
                    </button>
                  </div>
                </div>

                <div className="row-b mt-8">
                  <span className="fs-12 t-muted num">
                    {x.plan} · {t("col_end")} {fmtDate(x.endDate)}
                  </span>
                  <button
                    className="fs-12 t-gold"
                    onClick={() => setOpenId(openId === x.subscriptionId ? null : x.subscriptionId)}
                  >
                    {openId === x.subscriptionId ? t("close") : "···"}
                  </button>
                </div>

                {openId === x.subscriptionId && (
                  <pre
                    className="mt-8"
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "var(--text-2)",
                      background: "rgba(255,255,255,.04)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {x.text}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
