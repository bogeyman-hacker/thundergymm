"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Avatar, DaysRing, PageHead, StateBadge } from "@/components/ui";
import {
  Camera, Check, X, ScanIcon, Whats, Alert, Refresh, QrIcon, ChevronR, ChevronL,
} from "@/components/Icons";
import type { MemberDTO } from "@/lib/queries";

type ScanResult = {
  found: boolean;
  granted: boolean;
  duplicate?: boolean;
  reason?: string | null;
  member?: MemberDTO;
  reminder?: {
    kind: string;
    text: string;
    link: string;
    subscriptionId: number;
  } | null;
};

const READER_ID = "tg-reader";

export default function ScanPage() {
  const { t, lang, dir, fmtDate } = useI18n();
  const toast = useToast();
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [camIdx, setCamIdx] = useState(0);

  const scannerRef = useRef<any>(null);
  const lockRef = useRef(false);

  // ── submit a code to the API ────────────────────────────────
  const submitCode = useCallback(
    async (code: string) => {
      if (!code || lockRef.current) return;
      lockRef.current = true;
      setChecking(true);
      setReminderSent(false);

      const r = await api.post<ScanResult>("/api/scan", { code, source: "mobile_qr" });
      setChecking(false);

      if (!r.ok) {
        toast(r.error, "err");
        lockRef.current = false;
        return;
      }
      setResult(r as any);
      window.dispatchEvent(new Event("tg:refresh-notifications"));

      // haptics
      try {
        navigator.vibrate?.(r.granted ? [40] : [70, 60, 70]);
      } catch {}

      setTimeout(() => {
        lockRef.current = false;
      }, 1200);
    },
    [toast]
  );

  // ── camera control ──────────────────────────────────────────
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
          /* getCameras can fail before permission is granted; fall back below */
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
          aspectRatio: 1,
        };

        const camSource =
          devices.length > 0 ? { deviceId: { exact: devices[index % devices.length].id } } : { facingMode: "environment" };

        await scanner.start(
          camSource as any,
          config,
          (decoded: string) => {
            submitCode(decoded);
          },
          () => {
            /* per-frame decode misses — ignore */
          }
        );

        setRunning(true);
      } catch (e: any) {
        const msg = String(e?.message || e);
        setCamErr(/permission|NotAllowed/i.test(msg) ? t("cam_denied") : msg);
      } finally {
        setStarting(false);
      }
    },
    [camIdx, stop, submitCode, t]
  );

  useEffect(() => () => void stop(), [stop]);

  async function switchCam() {
    const next = camIdx + 1;
    setCamIdx(next);
    await stop();
    await start(next);
  }

  async function markReminderSent() {
    if (!result?.reminder || !result.member) return;
    const r = await api.post("/api/reminders", {
      subscriptionId: result.reminder.subscriptionId,
      memberId: result.member.id,
      kind: result.reminder.kind,
      text: result.reminder.text,
      phone: result.member.phone,
    });
    if (r.ok) {
      setReminderSent(true);
      toast(t("marked"));
    }
  }

  function reset() {
    setResult(null);
    setManual("");
    setReminderSent(false);
    lockRef.current = false;
  }

  const reasonText = (reason?: string | null) => {
    switch (reason) {
      case "expired": return t("reason_expired");
      case "none": return t("reason_none");
      case "blocked": return t("reason_blocked");
      case "frozen": return t("reason_frozen");
      case "duplicate": return t("reason_duplicate");
      default: return t("reason_unknown");
    }
  };

  return (
    <>
      <PageHead title={t("scan_title")} sub={t("scan_sub")} />

      <div className="scan-grid">
        {/* ── camera ─────────────────────────────────────── */}
        <div className="card card-pad anim-up">
          <div className="scanbox">
            <div id={READER_ID} style={{ width: "100%", height: "100%" }} />
            {running && (
              <div className="scan-frame">
                <i /><i /><i /><i />
                <u />
              </div>
            )}
            {!running && (
              <div className="scan-placeholder">
                <QrIcon />
                <div className="fs-13">{starting ? t("loading") : t("scan_sub")}</div>
              </div>
            )}
            {checking && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeContent: "center",
                  background: "rgba(5,7,11,.75)",
                  backdropFilter: "blur(3px)",
                }}
              >
                <span className="spinner" style={{ width: 34, height: 34, color: "var(--gold)" }} />
              </div>
            )}
          </div>

          <div className="row gap-10 wrap mt-16">
            {!running ? (
              <button className="btn btn-primary grow" onClick={() => start()} disabled={starting}>
                {starting ? <span className="spinner" /> : <Camera />}
                {t("start_cam")}
              </button>
            ) : (
              <>
                <button className="btn btn-ghost grow" onClick={stop}>
                  <X />
                  {t("stop_cam")}
                </button>
                {cameras.length > 1 && (
                  <button className="btn btn-outline" onClick={switchCam}>
                    <Refresh />
                    {t("switch_cam")}
                  </button>
                )}
              </>
            )}
          </div>

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
                  if (e.key === "Enter") submitCode(manual);
                }}
              />
              <button
                className="btn btn-ghost"
                onClick={() => submitCode(manual)}
                disabled={!manual || checking}
              >
                <ScanIcon />
                {t("check")}
              </button>
            </div>
          </div>
        </div>

        {/* ── result ─────────────────────────────────────── */}
        <div className="col gap-16">
          {!result ? (
            <div className="card card-pad" style={{ minHeight: 260, display: "grid", placeContent: "center" }}>
              <div className="empty">
                <ScanIcon width={44} height={44} style={{ margin: "0 auto 12px", opacity: 0.28 }} />
                {t("scan_sub")}
              </div>
            </div>
          ) : !result.found ? (
            <div className="result bad">
              <div className="result-ico">
                <X />
              </div>
              <h2>{t("access_denied")}</h2>
              <p className="t-2">{t("reason_unknown")}</p>
              <button className="btn btn-ghost mt-16" onClick={reset}>
                <Refresh />
                {t("scan_again")}
              </button>
            </div>
          ) : (
            <>
              <div
                className={`result ${
                  result.granted ? (result.member!.state === "expiring" ? "warn" : "ok") : "bad"
                }`}
              >
                <div className="result-ico">{result.granted ? <Check /> : <Alert />}</div>
                <h2>{result.granted ? t("access_granted") : t("access_denied")}</h2>
                <p className="t-2 fs-13">
                  {result.duplicate
                    ? t("reason_duplicate")
                    : result.granted
                    ? result.member!.sub?.plan
                    : reasonText(result.reason)}
                </p>

                <div className="mt-16" style={{ display: "grid", placeItems: "center" }}>
                  <DaysRing
                    left={result.member!.daysLeft}
                    total={result.member!.totalDays}
                    state={result.member!.state}
                  />
                </div>

                <div className="row gap-12 mt-16" style={{ justifyContent: "center" }}>
                  <Avatar name={result.member!.name} gender={result.member!.gender} />
                  <div style={{ textAlign: "start" }}>
                    <div className="fw-7 fs-18">{result.member!.name}</div>
                    <div className="fs-12 t-muted mono">
                      {result.member!.serial} · {result.member!.phone}
                    </div>
                  </div>
                </div>

                {result.member!.sub && (
                  <div className="fs-12 t-muted mt-8 num">
                    {t("col_end")}: {fmtDate(result.member!.sub.end)}
                  </div>
                )}

                <div className="row gap-8 mt-16" style={{ justifyContent: "center" }}>
                  <StateBadge state={result.member!.state} />
                </div>

                <div className="row gap-8 mt-16 wrap" style={{ justifyContent: "center" }}>
                  <button className="btn btn-ghost" onClick={reset}>
                    <Refresh />
                    {t("scan_again")}
                  </button>
                  <Link href={`/members/${result.member!.id}`} className="btn btn-outline">
                    {t("open_profile")}
                    <Arrow />
                  </Link>
                </div>
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
                    <button
                      className="btn btn-outline"
                      onClick={markReminderSent}
                      disabled={reminderSent}
                    >
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
