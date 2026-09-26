"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Avatar, DaysRing, PageHead, StateBadge } from "@/components/ui";
import {
  Camera, Check, X, ScanIcon, Whats, Alert, Refresh, QrIcon, ChevronR, ChevronL, Clock,
} from "@/components/Icons";
import type { MemberDTO } from "@/lib/queries";

type Reminder = { kind: string; text: string; link: string; subscriptionId: number };

type ScanResult = {
  entity?: "staff";
  staff?: { id: number; serial: string; name: string; jobTitle: string; active: boolean };
  action?: "checkin" | "checkout";
  nextAction?: "checkin" | "checkout";
  mode?: "lookup" | "checkin";
  found: boolean;
  granted: boolean;
  duplicate?: boolean;
  consumed?: boolean;
  countedToday?: boolean;
  usesSessions?: boolean;
  sessionsLeft?: number | null;
  reason?: string | null;
  member?: MemberDTO;
  reminder?: Reminder | null;
};

const READER_ID = "tg-reader";

/* A barcode gun "types" a whole code in a few ms, then sends Enter.
 * Anything slower than this between keystrokes is a human at a keyboard. */
const GUN_MAX_GAP_MS = 120;
const GUN_MIN_LENGTH = 4;

export default function ScanPage() {
  const { t, lang, dir, fmtDate } = useI18n();
  const toast = useToast();
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  const [mode, setMode] = useState<"gun" | "camera">("gun");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [camIdx, setCamIdx] = useState(0);
  const [gunFeed, setGunFeed] = useState("");

  const scannerRef = useRef<any>(null);
  const lockRef = useRef(false);
  const lastCodeRef = useRef("");

  /* ── talk to the API ──────────────────────────────────────── */

  /** Identify the member without recording anything. */
  const lookup = useCallback(
    async (code: string, source = "usb_scanner") => {
      if (!code || lockRef.current) return;
      lockRef.current = true;
      lastCodeRef.current = code;
      setChecking(true);
      setReminderSent(false);

      const r = await api.post<ScanResult>("/api/scan", { code, source, mode: "lookup" });
      setChecking(false);

      if (!r.ok) {
        toast(r.error, "err");
        lockRef.current = false;
        return;
      }
      setResult(r as any);
      try {
        navigator.vibrate?.((r as any).granted ? [35] : [70, 60, 70]);
      } catch {}
      setTimeout(() => {
        lockRef.current = false;
      }, 700);
    },
    [toast]
  );

  /** Commit the entry — this is what deducts a session. */
  const registerDay = useCallback(async () => {
    const code = lastCodeRef.current;
    if (!code || committing) return;
    setCommitting(true);

    const r = await api.post<ScanResult>("/api/scan", {
      code,
      source: mode === "camera" ? "mobile_qr" : "usb_scanner",
      mode: "checkin",
    });
    setCommitting(false);

    if (!r.ok) {
      toast(r.error, "err");
      return;
    }
    setResult(r as any);
    window.dispatchEvent(new Event("tg:refresh-notifications"));

    const res = r as any as ScanResult;
    if (res.granted) {
      toast(res.entity === "staff"
        ? (res.action === "checkout" ? (lang === "ar" ? "تم تسجيل انصراف الموظف" : "Staff clocked out")
            : (lang === "ar" ? "تم تسجيل حضور الموظف" : "Staff clocked in"))
        : res.consumed ? t("session_deducted") : t("day_registered"), "ok");
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {}
    }
  }, [committing, mode, lang, t, toast]);

  /* ── scanner gun: a global keyboard listener ──────────────── */
  useEffect(() => {
    if (mode !== "gun") return;

    let buf = "";
    let last = 0;
    let timer: any = null;

    const flush = () => {
      const code = buf.trim();
      buf = "";
      setGunFeed("");
      if (code.length >= GUN_MIN_LENGTH) lookup(code, "usb_scanner");
    };

    const onKey = (e: KeyboardEvent) => {
      // Never hijack real typing in a form field.
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      if (now - last > GUN_MAX_GAP_MS) buf = "";
      last = now;

      if (e.key === "Enter") {
        if (timer) clearTimeout(timer);
        if (buf.length >= GUN_MIN_LENGTH) {
          e.preventDefault();
          flush();
        }
        return;
      }

      if (e.key.length !== 1) return;
      buf += e.key;
      setGunFeed(buf);

      // Some guns are not configured to send Enter — flush on a pause.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (buf.length >= GUN_MIN_LENGTH) flush();
        else {
          buf = "";
          setGunFeed("");
        }
      }, 260);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, [mode, lookup]);

  /* ── optional camera fallback ─────────────────────────────── */
  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch {}
    scannerRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(
    async (index = camIdx) => {
      setCamErr("");
      setStarting(true);
      try {
        if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost") {
          setCamErr(t("cam_https"));
          setStarting(false);
          return;
        }

        const { Html5Qrcode } = await import("html5-qrcode");

        let devices: { id: string; label: string }[] = [];
        try {
          devices = (await Html5Qrcode.getCameras()) as any;
          setCameras(devices);
        } catch {
          /* getCameras can fail before permission is granted */
        }

        await stop();
        const scanner = new Html5Qrcode(READER_ID, { verbose: false });
        scannerRef.current = scanner;

        const config = {
          fps: 12,
          qrbox: (vw: number, vh: number) => {
            const m = Math.floor(Math.min(vw, vh) * 0.72);
            return { width: m, height: m };
          },
        };

        const camera =
          devices.length > 0
            ? { deviceId: { exact: devices[index % devices.length].id } }
            : { facingMode: "environment" };

        await scanner.start(camera as any, config, (text: string) => lookup(text, "mobile_qr"), () => {});
        setRunning(true);
      } catch (err: any) {
        setCamErr(String(err?.message || err) || t("cam_denied"));
      } finally {
        setStarting(false);
      }
    },
    [camIdx, lookup, stop, t]
  );

  useEffect(() => {
    if (mode !== "camera") stop();
    return () => {
      stop();
    };
  }, [mode, stop]);

  /* ── misc ─────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    setResult(null);
    setManual("");
    setReminderSent(false);
    lastCodeRef.current = "";
    lockRef.current = false;
  }, []);

  async function markReminderSent() {
    const rem = result?.reminder;
    if (!rem || reminderSent) return;
    setReminderSent(true);
    await api.post("/api/reminders", {
      subscriptionId: rem.subscriptionId,
      memberId: result!.member!.id,
      kind: rem.kind,
      text: rem.text,
    });
  }

  function reasonText(reason?: string | null) {
    switch (reason) {
      case "expired": return t("reason_expired");
      case "not_started": return lang === "ar" ? "الاشتراك لم يبدأ بعد" : "Subscription has not started yet";
      case "no_sessions": return t("reason_no_sessions");
      case "none": return t("reason_none");
      case "blocked": return t("reason_blocked");
      case "frozen": return t("reason_frozen");
      default: return t("reason_unknown");
    }
  }

  const m = result?.member;
  const uses = !!result?.usesSessions;
  const isLookup = result?.mode === "lookup";

  return (
    <>
      <PageHead title={t("scan_title")} sub={mode === "gun" ? t("gun_hint") : t("scan_sub")} />

      <div className="scan-grid">
        {/* ── input side ───────────────────────────────── */}
        <div className="card card-pad">
          <div className="row-b" style={{ marginBottom: 14 }}>
            <b className="fs-14">{mode === "gun" ? t("gun_title") : t("scan_title")}</b>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMode(mode === "gun" ? "camera" : "gun")}
            >
              {mode === "gun" ? <Camera /> : <ScanIcon />}
              {mode === "gun" ? t("use_camera") : t("use_gun")}
            </button>
          </div>

          {mode === "gun" ? (
            <div
              className="col"
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 240,
                textAlign: "center",
                border: "1px dashed var(--line)",
                borderRadius: 14,
                padding: "26px 18px",
                background: "rgba(255,255,255,.02)",
              }}
            >
              <div
                style={{
                  width: 62, height: 62, borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  background: "var(--accent-soft)", color: "var(--accent)",
                  marginBottom: 14,
                  animation: checking ? "none" : "tgPulse 1.9s ease-in-out infinite",
                }}
              >
                <ScanIcon width={28} height={28} />
              </div>

              <b className="fs-15">{checking ? t("gun_reading") : t("gun_ready")}</b>
              <p className="fs-13 t-2 mt-8" style={{ maxWidth: 320 }}>
                {t("gun_hint")}
              </p>

              <div
                className="mono fs-13 mt-16"
                dir="ltr"
                style={{
                  minHeight: 34, minWidth: 190,
                  display: "grid", placeItems: "center",
                  padding: "7px 14px", borderRadius: 9,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid var(--line)",
                  color: gunFeed ? "var(--accent)" : "var(--text-muted)",
                  letterSpacing: gunFeed ? ".08em" : 0,
                }}
              >
                {gunFeed || t("gun_listening")}
              </div>

              <style>{`@keyframes tgPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.09);opacity:.72}}`}</style>
            </div>
          ) : (
            <>
              <div className="scanbox">
                <div id={READER_ID} />
              </div>

              <div className="row gap-8 mt-16 wrap">
                {!running ? (
                  <button className="btn btn-primary grow" onClick={() => start()} disabled={starting}>
                    {starting ? <span className="spinner" /> : <Camera />}
                    {t("start_cam")}
                  </button>
                ) : (
                  <button className="btn btn-ghost grow" onClick={stop}>
                    <X />
                    {t("stop_cam")}
                  </button>
                )}
                {cameras.length > 1 && running && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const n = (camIdx + 1) % cameras.length;
                      setCamIdx(n);
                      start(n);
                    }}
                  >
                    <Refresh />
                  </button>
                )}
              </div>

              <p className="hint mt-8">{t("cam_optional")}</p>
            </>
          )}

          {camErr && (
            <div
              className="fs-13 mt-16"
              style={{
                padding: "11px 14px",
                borderRadius: 10,
                background: "var(--danger-soft)",
                color: "var(--danger)",
                border: "1px solid rgba(251,113,133,.25)",
              }}
            >
              {camErr}
            </div>
          )}

          <div className="divider" />

          <div className="field">
            <label className="label">{t("manual_entry")}</label>
            <div className="row gap-8">
              <input
                className="input mono grow"
                dir="ltr"
                placeholder={t("manual_ph")}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookup(manual, "manual");
                }}
              />
              <button
                className="btn btn-ghost"
                onClick={() => lookup(manual, "manual")}
                disabled={!manual || checking}
              >
                <ScanIcon />
                {t("check")}
              </button>
            </div>
          </div>
        </div>

        {/* ── result side ──────────────────────────────── */}
        <div className="col gap-16">
          {!result ? (
            <div className="card card-pad" style={{ minHeight: 260, display: "grid", placeContent: "center" }}>
              <div className="empty">
                <ScanIcon width={44} height={44} style={{ margin: "0 auto 12px", opacity: 0.28 }} />
                {mode === "gun" ? t("gun_listening") : t("scan_sub")}
              </div>
            </div>
          ) : !result.found ? (
            <div className="result bad">
              <div className="result-ico"><X /></div>
              <h2>{t("access_denied")}</h2>
              <p className="t-2">{t("reason_unknown")}</p>
              <button className="btn btn-ghost mt-16" onClick={reset}>
                <Refresh />
                {t("scan_again")}
              </button>
            </div>
          ) : result.entity === "staff" ? (
            <div className={`result ${result.granted ? "ok" : "bad"}`}>
              <div className="result-ico">{result.granted ? <Check /> : <Alert />}</div>
              <div className="badge b-active" style={{ marginBottom: 10 }}>
                {lang === "ar" ? "موظف • حضور وانصراف" : "Staff • attendance"}
              </div>
              <h2>{result.staff?.name}</h2>
              <p className="t-2 fs-13 mono">{result.staff?.serial} · {result.staff?.jobTitle}</p>
              <p className="mt-16 fs-14">
                {!result.granted ? (lang === "ar" ? "الموظف غير مفعل" : "Staff is inactive")
                  : result.duplicate ? (lang === "ar" ? "اتسجل من أقل من دقيقتين — مفيش تكرار" : "Recorded recently — no duplicate")
                  : !isLookup ? (result.action === "checkout"
                    ? (lang === "ar" ? "تم تسجيل الانصراف ✅" : "Clock-out recorded ✅")
                    : (lang === "ar" ? "تم تسجيل الحضور ✅" : "Clock-in recorded ✅"))
                  : (result.nextAction === "checkout"
                    ? (lang === "ar" ? "مسجّل حضور — جاهز لتسجيل الانصراف" : "Clocked in — ready to clock out")
                    : (lang === "ar" ? "جاهز لتسجيل الحضور" : "Ready to clock in"))}
              </p>
              <div className="row gap-8 mt-16 wrap" style={{ justifyContent: "center" }}>
                {result.granted && isLookup && (
                  <button className="btn btn-primary" onClick={registerDay} disabled={committing}>
                    {committing ? <span className="spinner" /> : <Check />}
                    {result.nextAction === "checkout"
                      ? (lang === "ar" ? "تسجيل انصراف" : "Clock out")
                      : (lang === "ar" ? "تسجيل حضور" : "Clock in")}
                  </button>
                )}
                <Link className="btn btn-outline" href="/staff">
                  {lang === "ar" ? "صفحة الموظفين" : "Staff"}
                </Link>
                <button className="btn btn-ghost" onClick={reset}><Refresh />{t("scan_again")}</button>
              </div>
            </div>
          ) : (
            <>
              <div className={`result ${result.granted ? (m!.state === "expiring" ? "warn" : "ok") : "bad"}`}>
                <div className="result-ico">{result.granted ? <Check /> : <Alert />}</div>
                <h2>{result.granted ? t("access_granted") : t("access_denied")}</h2>
                <p className="t-2 fs-13">
                  {result.duplicate
                    ? t("reason_duplicate")
                    : result.granted
                    ? m!.sub?.plan
                    : reasonText(result.reason)}
                </p>

                <div className="mt-16" style={{ display: "grid", placeItems: "center" }}>
                  <DaysRing
                    left={uses ? m!.sessionsLeft : m!.daysLeft}
                    total={uses ? m!.sessionsTotal : m!.totalDays}
                    state={m!.state}
                  />
                </div>

                {/* sessions balance */}
                {uses && (
                  <div className="fs-13 mt-8">
                    <b className="num" style={{ color: "var(--accent)" }}>
                      {m!.sessionsLeft}
                    </b>{" "}
                    <span className="t-2">
                      {t("sessions_of")} <span className="num">{m!.sessionsTotal}</span> {t("sessions_label")}
                    </span>
                  </div>
                )}

                <div className="row gap-12 mt-16" style={{ justifyContent: "center" }}>
                  <Avatar name={m!.name} gender={m!.gender} />
                  <div style={{ textAlign: "start" }}>
                    <div className="fw-7 fs-18">{m!.name}</div>
                    <div className="fs-12 t-muted mono">
                      {m!.serial} · {m!.phone}
                    </div>
                  </div>
                </div>

                {m!.sub && (
                  <div className="fs-12 t-muted mt-8 num">
                    {t("col_end")}: {fmtDate(m!.sub.end)}
                    {" · "}
                    <span className="num">{m!.daysLeft}</span> {t("days_label")}
                  </div>
                )}

                <div className="row gap-8 mt-16" style={{ justifyContent: "center" }}>
                  <StateBadge state={m!.state} />
                  {result.countedToday && (
                    <span className="badge b-expiring plain">
                      <Clock width={12} height={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                      {t("already_today")}
                    </span>
                  )}
                </div>

                {/* ── the two action buttons ─────────────── */}
                <div className="row gap-8 mt-16 wrap" style={{ justifyContent: "center" }}>
                  <Link href={`/members/${m!.id}`} className="btn btn-outline">
                    <QrIcon />
                    {t("btn_details")}
                  </Link>

                  {result.granted && isLookup && (
                    <button
                      className="btn btn-primary"
                      onClick={registerDay}
                      disabled={committing}
                    >
                      {committing ? <span className="spinner" /> : <Check />}
                      {committing ? t("registering") : t("btn_register_day")}
                    </button>
                  )}

                  <button className="btn btn-ghost" onClick={reset}>
                    <Refresh />
                    {t("scan_again")}
                  </button>
                </div>

                {isLookup && result.granted && (
                  <p className="hint mt-8">
                    {result.countedToday ? t("already_today_hint") : t("no_deduct_note")}
                  </p>
                )}

                {result.consumed && (
                  <p className="fs-13 mt-8" style={{ color: "var(--ok)" }}>
                    <Check width={14} height={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
                    {t("session_deducted")}
                  </p>
                )}
              </div>

              {/* reminder */}
              {result.reminder && (
                <div className="card card-pad anim-up" style={{ borderColor: "rgba(37,211,102,.28)" }}>
                  <div className="row-b" style={{ marginBottom: 10 }}>
                    <b className="fs-14">
                      <Whats
                        width={15}
                        height={15}
                        style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 6, color: "#25D366" }}
                      />
                      {t("reminder_ready")}
                    </b>
                    <span className="badge b-expiring plain">
                      {result.reminder.kind === "mid"
                        ? t("rem_mid")
                        : result.reminder.kind === "expired"
                        ? t("rem_expired")
                        : t("rem_end")}
                    </span>
                  </div>

                  <pre
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
                    {result.reminder.text}
                  </pre>

                  <div className="row gap-8 mt-16 wrap">
                    <a
                      className="btn btn-wa grow"
                      href={result.reminder.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setTimeout(markReminderSent, 400)}
                    >
                      <Whats />
                      {t("open_wa")}
                    </a>
                    <button className="btn btn-outline" onClick={markReminderSent} disabled={reminderSent}>
                      <Check />
                      {reminderSent ? t("marked") : t("mark_sent")}
                    </button>
                  </div>
                  <p className="hint mt-8">{t("send_all_note")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
