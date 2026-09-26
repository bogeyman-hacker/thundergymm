"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Avatar, DaysRing, Loading, Money, PageHead, StateBadge } from "@/components/ui";
import {
  Whats, Download, Printer, Refresh, Snowflake, Trash, Check, X, Phone, Calendar, ChevronL, ChevronR,
} from "@/components/Icons";
import type { MemberDTO } from "@/lib/queries";

type Plan = { id: number; name_ar: string; name_en: string; duration_days: number; price: string; active: 0 | 1 };
type Sub = {
  id: number; plan_label: string; duration_days: number; start_date: string;
  end_date: string; price: string; paid: string; status: string; created_at: string;
};
type Visit = { id: number; scanned_at: string; result: string; days_left: number | null };

export default function MemberPage() {
  const { t, lang, dir, fmtDate, fmtDateTime } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const id = params.id;
  const Back = dir === "rtl" ? ChevronR : ChevronL;

  const [member, setMember] = useState<MemberDTO | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [qr, setQr] = useState<string>("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [renewOpen, setRenewOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeMode, setFreezeMode] = useState<"manual" | "fixed">("manual");
  const [freezeDays, setFreezeDays] = useState("7");
  const [renewPlan, setRenewPlan] = useState("");
  const [renewDays, setRenewDays] = useState("");
  const [renewPrice, setRenewPrice] = useState("");
  const [renewPaid, setRenewPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [waText, setWaText] = useState("");

  const load = useCallback(async () => {
    const r = await api.get<{ member: MemberDTO; subscriptions: Sub[]; visits: Visit[] }>(
      `/api/members/${id}`
    );
    if (r.ok) {
      setMember(r.member);
      setSubs(r.subscriptions);
      setVisits(r.visits);
    }
  }, [id]);

  useEffect(() => {
    load();
    (async () => {
      const [qrRes, plansRes] = await Promise.all([
        api.get<{ dataUrl: string }>(`/api/members/${id}/qr?size=560`),
        api.get<{ plans: Plan[] }>("/api/plans"),
      ]);
      if (qrRes.ok) setQr(qrRes.dataUrl);
      if (plansRes.ok) {
        const act = plansRes.plans.filter((p) => p.active);
        setPlans(act);
        const m = act.find((p) => p.duration_days === 30) ?? act[0];
        if (m) {
          setRenewPlan(String(m.id));
          setRenewPrice(String(Number(m.price)));
          setRenewPaid(String(Number(m.price)));
        }
      }
    })();
  }, [id, load]);

  // welcome message for a freshly created member
  useEffect(() => {
    if (!member || sp.get("new") !== "1") return;
    const gym = "ThunderGym";
    const txt =
      lang === "ar"
        ? `أهلاً ${member.name} 👋\nتم تفعيل اشتراكك في ${gym}.\n\n• الكود: ${member.serial}\n• الباقة: ${member.sub?.plan}\n• ينتهي في: ${member.sub?.end}\n\nاحتفظ بكود الـ QR، هتعمل بيه سكان عند الدخول 💪`
        : `Hi ${member.name} 👋\nYour ${gym} membership is active.\n\n• Code: ${member.serial}\n• Plan: ${member.sub?.plan}\n• Expires: ${member.sub?.end}\n\nKeep your QR handy — scan it on entry 💪`;
    setWaText(txt);
  }, [member, sp, lang]);

  async function setStatus(status: "active" | "frozen" | "blocked", days?: number | null) {
    setBusy(true);
    const r = await api.patch(`/api/members/${id}`, { status, ...(status === "frozen" ? { freezeDays: days ?? null } : {}) });
    setBusy(false);
    if (r.ok) {
      toast(t("saved"));
      setFreezeOpen(false);
      load();
    } else toast(r.error, "err");
  }

  async function remove() {
    if (!confirm(t("confirm_del"))) return;
    const r = await api.del(`/api/members/${id}`);
    if (r.ok) {
      toast(t("saved"));
      router.push("/members");
    } else toast(r.error, "err");
  }

  async function doRenew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: any = { price: Number(renewPrice || 0), paid: Number(renewPaid || 0) };
    if (renewPlan === "custom") {
      payload.durationDays = Number(renewDays);
      payload.planLabel = lang === "ar" ? `مخصص ${renewDays} يوم` : `Custom ${renewDays} days`;
    } else payload.planId = Number(renewPlan);

    const r = await api.post(`/api/members/${id}/renew`, payload);
    setBusy(false);
    if (r.ok) {
      toast(t("saved"));
      setRenewOpen(false);
      load();
    } else toast(r.error, "err");
  }

  function downloadCard() {
    if (!qr || !member) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `${member.serial}-${member.name.replace(/\s+/g, "_")}.png`;
    a.click();
  }

  if (!member) return <Loading />;

  const waHref = `https://wa.me/${member.phone}${waText ? `?text=${encodeURIComponent(waText)}` : ""}`;

  return (
    <>
      <PageHead
        title={member.name}
        sub={`${member.serial} · ${member.phone}`}
        right={
          <>
            <Link href="/members" className="btn btn-ghost btn-sm">
              <Back />
              {t("back")}
            </Link>
            <a className="btn btn-wa btn-sm" href={waHref} target="_blank" rel="noreferrer">
              <Whats />
              {t("send_wa")}
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => setRenewOpen(true)}>
              <Refresh />
              {t("renew")}
            </button>
          </>
        }
      />

      <div className="profile-grid">
        {/* ── left: card + QR ─────────────────────────── */}
        <div className="col gap-16">
          <div className="card card-pad anim-up">
            <div className="row gap-14" style={{ marginBottom: 18 }}>
              <Avatar name={member.name} gender={member.gender} size="lg" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="fw-7 fs-18 truncate">{member.name}</div>
                <div className="fs-12 t-muted mono">{member.serial}</div>
                <div className="mt-8">
                  <StateBadge state={member.state} />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
              <DaysRing left={member.daysLeft} total={member.totalDays} state={member.state} size={148} />
            </div>

            <div className="col gap-8 fs-13">
              <div className="row-b">
                <span className="t-muted">{t("col_plan")}</span>
                <b>{member.sub?.plan ?? "—"}</b>
              </div>
              <div className="row-b">
                <span className="t-muted">{t("col_end")}</span>
                <b className="num">{member.sub ? fmtDate(member.sub.end) : "—"}</b>
              </div>
              {member.memberStatus === "frozen" && (
                <div className="fs-12" style={{ color: "var(--info)" }}>
                  ❄️ {lang === "ar" ? "المدة متوقفة من" : "Paused since"} {member.frozenAt}
                  {member.freezeUntil && <> · {lang === "ar" ? "يفك تلقائيًا" : "Auto-resume"} {member.freezeUntil}</>}
                  <div className="t-muted">{lang === "ar"
                    ? "تاريخ الانتهاء هيتأخر بعدد أيام التجميد عند الفك"
                    : "The expiry date will be extended by the paused days on resume"}</div>
                </div>
              )}
              <div className="row-b">
                <span className="t-muted">{t("total_visits")}</span>
                <b className="num">{member.visits}</b>
              </div>
              <div className="row-b">
                <span className="t-muted">{t("last_visit")}</span>
                <b className="num fs-12">
                  {member.lastVisit ? fmtDateTime(member.lastVisit) : t("never")}
                </b>
              </div>
              <div className="row-b">
                <span className="t-muted">{t("member_since")}</span>
                <b className="num fs-12">{fmtDate(member.createdAt)}</b>
              </div>
            </div>

            <div className="divider" />

            <div className="row gap-8 wrap">
              {member.memberStatus === "frozen" ? (
                <button className="btn btn-outline btn-sm" onClick={() => setStatus("active")} disabled={busy}>
                  <Check />
                  {t("unfreeze")}
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={() => setFreezeOpen(true)} disabled={busy}>
                  <Snowflake />
                  {t("freeze")}
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={remove}>
                <Trash />
                {t("del")}
              </button>
            </div>
          </div>

          {/* QR card */}
          <div className="card card-pad anim-up d2">
            <div className="card-head" style={{ padding: 0, border: 0, marginBottom: 16 }}>
              <h3>{t("qr_card")}</h3>
            </div>

            <div id="tg-print-card" className="qrcard">
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", marginBottom: 2 }}>
                Thunder<span style={{ color: "#FFC531" }}>Gym</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#7A8296", marginBottom: 16, letterSpacing: ".04em" }}>
                MEMBERSHIP CARD
              </div>

              {qr ? (
                <div className="qrcard-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={member.serial} />
                </div>
              ) : (
                <div className="skeleton" style={{ width: 214, height: 214, margin: "0 auto" }} />
              )}

              <div style={{ marginTop: 16, fontWeight: 700, fontSize: 15.5 }}>{member.name}</div>
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 13,
                  color: "#FFC531",
                  letterSpacing: ".08em",
                  marginTop: 3,
                }}
              >
                {member.serial}
              </div>
              <div style={{ fontSize: 11, color: "#7A8296", marginTop: 10 }}>
                {member.sub?.plan} · {member.sub ? member.sub.end : "—"}
              </div>
            </div>

            <div className="row gap-8 mt-16 no-print">
              <button className="btn btn-ghost btn-sm grow" onClick={downloadCard}>
                <Download />
                {t("download_qr")}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                <Printer />
                {t("print_qr")}
              </button>
            </div>
          </div>
        </div>

        {/* ── right: history ──────────────────────────── */}
        <div className="col gap-16" style={{ minWidth: 0 }}>
          <div className="card anim-up d2">
            <div className="card-head">
              <h3>
                <Calendar
                  width={15}
                  height={15}
                  style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 6, color: "var(--gold)" }}
                />
                {t("sub_history")}
              </h3>
            </div>
            <div className="table-wrap">
              <table className="tg">
                <thead>
                  <tr>
                    <th>{t("col_plan")}</th>
                    <th className="hide-sm">{t("start_date")}</th>
                    <th>{t("col_end")}</th>
                    <th>{t("price")}</th>
                    <th>{t("col_status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="fw-6 fs-13">{s.plan_label}</div>
                        <div className="fs-11 t-muted num">
                          {s.duration_days} {t("days")}
                        </div>
                      </td>
                      <td className="hide-sm fs-13 num t-2">{fmtDate(s.start_date)}</td>
                      <td className="fs-13 num t-2">{fmtDate(s.end_date)}</td>
                      <td className="fs-13">
                        <Money value={Number(s.paid)} />
                      </td>
                      <td>
                        <span className={`badge ${s.status === "active" ? "b-active" : "b-expired"}`}>
                          {s.status === "active" ? t("st_active") : t("st_expired")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card anim-up d3">
            <div className="card-head">
              <h3>{t("visit_history")}</h3>
              <span className="fs-12 t-muted num">{member.visits}</span>
            </div>
            {visits.length === 0 ? (
              <div className="empty">{t("never")}</div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
                <table className="tg">
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td style={{ width: 34 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: 99,
                              background: v.result === "granted" ? "var(--ok)" : "var(--danger)",
                            }}
                          />
                        </td>
                        <td className="fs-13 num">{fmtDateTime(v.scanned_at)}</td>
                        <td className="fs-12 t-muted" style={{ textAlign: "end" }}>
                          {v.result === "granted"
                            ? `${v.days_left ?? 0} ${t("days")}`
                            : t("res_denied")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {member.notes && (
            <div className="card card-pad anim-up d4">
              <div className="label" style={{ marginBottom: 8 }}>
                {t("notes")}
              </div>
              <p className="fs-14 t-2" style={{ whiteSpace: "pre-wrap" }}>
                {member.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── renew modal ─────────────────────────────────── */}
      {freezeOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 310, display: "grid", placeItems: "center",
                      padding: 20, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }}
             onClick={(e) => e.target === e.currentTarget && setFreezeOpen(false)}>
          <form className="card card-pad anim-pop"
                style={{ width: "min(430px,100%)", background: "var(--elev)" }}
                onSubmit={(e) => { e.preventDefault(); setStatus("frozen", freezeMode === "manual" ? null : Number(freezeDays)); }}>
            <div className="row-b"><h3 className="fs-18">❄️ {lang === "ar" ? "تجميد الاشتراك" : "Pause membership"}</h3>
              <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => setFreezeOpen(false)}><X /></button></div>
            <p className="hint mt-8">{lang === "ar"
              ? "الأيام والحصص هتقف أثناء التجميد. لما يتفك، تاريخ النهاية هيتأخر بعدد الأيام المجمدة."
              : "Days and sessions pause. On resume, the expiry date moves forward by the paused days."}</p>
            <div className="field mt-16"><label className="label">{lang === "ar" ? "طريقة الفك" : "Resume method"}</label>
              <select className="select" value={freezeMode} onChange={(e) => setFreezeMode(e.target.value as "manual" | "fixed")}>
                <option value="manual">{lang === "ar" ? "أفكّه بنفسي" : "Manual resume"}</option>
                <option value="fixed">{lang === "ar" ? "بعد مدة محددة تلقائيًا" : "Automatic after a duration"}</option>
              </select></div>
            {freezeMode === "fixed" && <div className="field mt-16"><label className="label">{lang === "ar" ? "عدد أيام التجميد" : "Pause days"}</label>
              <input className="input num" dir="ltr" type="number" min={1} max={365} required value={freezeDays}
                     onChange={(e) => setFreezeDays(e.target.value)} /></div>}
            <div className="row gap-8 mt-16"><button className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : <Snowflake />}{t("freeze")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setFreezeOpen(false)}>{t("cancel")}</button></div>
          </form>
        </div>
      )}

      {renewOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0,0,0,.66)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn .2s ease",
          }}
          onClick={(e) => e.target === e.currentTarget && setRenewOpen(false)}
        >
          <form
            className="card card-pad anim-pop"
            style={{ width: "min(430px, 100%)", background: "var(--elev)" }}
            onSubmit={doRenew}
          >
            <div className="row-b" style={{ marginBottom: 6 }}>
              <h3 className="fs-18">{t("renew_title")}</h3>
              <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => setRenewOpen(false)}>
                <X />
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 18 }}>
              {t("renew_hint")}
            </p>

            <div className="col gap-16">
              <div className="field">
                <label className="label">{t("plan")}</label>
                <select
                  className="select"
                  value={renewPlan}
                  onChange={(e) => {
                    setRenewPlan(e.target.value);
                    const p = plans.find((x) => String(x.id) === e.target.value);
                    if (p) { setRenewPrice(String(Number(p.price))); setRenewPaid(String(Number(p.price))); }
                  }}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {lang === "ar" ? p.name_ar : p.name_en} — {p.duration_days} {t("days")}
                    </option>
                  ))}
                  <option value="custom">{lang === "ar" ? "مدة مخصصة…" : "Custom duration…"}</option>
                </select>
              </div>

              {renewPlan === "custom" && (
                <div className="field">
                  <label className="label">{t("custom_days")}</label>
                  <input
                    className="input num"
                    type="number"
                    min={1}
                    dir="ltr"
                    value={renewDays}
                    onChange={(e) => setRenewDays(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="field">
                <label className="label">{t("price")}</label>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  value={renewPrice}
                  onChange={(e) => setRenewPrice(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">{t("paid")}</label>
                <input className="input num" type="number" min={0} max={renewPrice || undefined}
                  step="0.01" dir="ltr" value={renewPaid}
                  onChange={(e) => setRenewPaid(e.target.value)} />
                <p className="hint">{lang === "ar" ? "لو دفع جزء فقط، الباقي يظهر في المالية لتسجيله لاحقًا." : "Unpaid balance appears in Finance for later payments."}</p>
              </div>

              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <span className="spinner" /> : <Check />}
                {t("save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
