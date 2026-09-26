"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { waLink } from "@/lib/wa";
import { useI18n } from "./I18nProvider";
import { Bell as BellIcon, Sound, Mute, Check, Whats } from "./Icons";

type Notif = {
  id: number;
  type: string;
  member_id: number | null;
  member_phone: string | null;
  member_name: string | null;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  severity: "info" | "success" | "warning" | "danger";
  is_read: 0 | 1;
  created_at: string;
};

const SOUND_KEY = "tg_sound";

/** Two-tone chime via WebAudio — no asset files needed. */
function chime(kind: "ok" | "warn") {
  try {
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = kind === "ok" ? [880, 1318.5] : [660, 440];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* ignore */
  }
}

export default function NotificationBell() {
  const { t, lang, fmtDateTime } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [sound, setSound] = useState(true);
  const [ring, setRing] = useState(false);
  const lastTop = useRef<number>(0);
  const first = useRef(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSound(localStorage.getItem(SOUND_KEY) !== "0");
  }, []);

  const load = useCallback(async () => {
    const r = await api.get<{ notifications: Notif[]; unread: number }>(
      "/api/notifications?limit=25"
    );
    if (!r.ok) return;
    setItems(r.notifications);
    setUnread(r.unread);

    const topId = r.notifications[0]?.id ?? 0;
    if (!first.current && topId > lastTop.current) {
      setRing(true);
      setTimeout(() => setRing(false), 1700);
      if (localStorage.getItem(SOUND_KEY) !== "0") {
        const sev = r.notifications[0]?.severity;
        chime(sev === "danger" || sev === "warning" ? "warn" : "ok");
      }
    }
    lastTop.current = topId;
    first.current = false;
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("tg:refresh-notifications", load as EventListener);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("tg:refresh-notifications", load as EventListener);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAll() {
    await api.post("/api/notifications", { all: true });
    setUnread(0);
    setItems((p) => p.map((n) => ({ ...n, is_read: 1 })));
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    if (next) chime("ok");
  }

  const dotColor = (s: Notif["severity"]) =>
    s === "success" ? "var(--ok)" : s === "warning" ? "var(--warn)" : s === "danger" ? "var(--danger)" : "var(--info)";

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className={`bell-btn ${ring ? "bell-ring" : ""}`}
        onClick={() => setOpen((p) => !p)}
        aria-label={t("notifications")}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-dot num">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <b className="fs-14">{t("notifications")}</b>
            <div className="row gap-6">
              <button
                className="btn btn-outline btn-sm btn-icon"
                onClick={toggleSound}
                title={sound ? t("sound_on") : t("sound_off")}
              >
                {sound ? <Sound /> : <Mute />}
              </button>
              {unread > 0 && (
                <button className="btn btn-outline btn-sm" onClick={markAll}>
                  <Check />
                  <span className="hide-sm">{t("mark_all_read")}</span>
                </button>
              )}
            </div>
          </div>

          <div className="dropdown-body">
            {items.length === 0 ? (
              <div className="empty">{t("no_notifications")}</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`notif ${n.is_read ? "" : "unread"}`}>
                  <span className="notif-dot" style={{ background: dotColor(n.severity) }} />
                  <div className="grow">
                    <div className="notif-t">{lang === "ar" ? n.title_ar : n.title_en}</div>
                    <div className="notif-b">{lang === "ar" ? n.body_ar : n.body_en}</div>
                    {n.type === "low_attendance" && n.member_phone && (
                      <div className="row gap-8 mt-8 wrap">
                        <a
                          className="btn btn-wa btn-sm"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={waLink(
                            n.member_phone,
                            lang === "ar"
                              ? `أهلاً ${n.member_name ?? ""} 👋\nوحشتنا في ThunderGym! حابين نطمن عليك ونشوف لو في حاجة نقدر نساعدك بيها عشان ترجع لتمرينك 💪`
                              : `Hi ${n.member_name ?? ""} 👋\nWe miss you at ThunderGym! Just checking in — let us know if there's anything we can do to help you get back to training 💪`
                          )}
                        >
                          <Whats width={14} height={14} />
                          {lang === "ar" ? "رسالة واتساب جاهزة" : "WhatsApp message"}
                        </a>
                        {n.member_id && (
                          <Link className="btn btn-outline btn-sm" href={`/members/${n.member_id}`}>
                            {t("open_profile")}
                          </Link>
                        )}
                      </div>
                    )}
                    <div className="notif-a num">{fmtDateTime(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
