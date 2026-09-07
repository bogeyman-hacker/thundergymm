"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n, LangToggle } from "@/components/I18nProvider";
import { api } from "@/lib/api";
import { Bolt, Lock, User, ChevronL, ChevronR } from "@/components/Icons";

export default function LoginPage() {
  const { t, lang, dir } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  useEffect(() => {
    (async () => {
      const r = await api.get<{ installed: boolean; admins: number }>("/api/setup");
      if (r.ok) setNeedsSetup(!r.installed || r.admins === 0);
      else setNeedsSetup(false);
    })();
  }, []);

  async function runSetup() {
    setBusy(true);
    setErr("");
    const r = await api.post("/api/setup", {
      username: "admin",
      password: "thunder123",
      name: "Gym Owner",
    });
    setBusy(false);
    if (r.ok) {
      setNeedsSetup(false);
      setUsername("admin");
      setPassword("thunder123");
    } else setErr(r.error);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api.post("/api/auth/login", { username, password });
    setBusy(false);
    if (r.ok) router.push("/dashboard");
    else setErr(r.error === "INVALID" ? t("login_error") : r.error);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="row-b" style={{ marginBottom: 22 }}>
          <Link href="/" className="row gap-8">
            <div className="logo">
              <Bolt />
            </div>
            <div>
              <div className="brandname">
                {lang === "ar" ? <>ثاندر<span>جيم</span></> : <>Thunder<span>Gym</span></>}
              </div>
              <div className="brandsub">{t("tagline")}</div>
            </div>
          </Link>
          <LangToggle compact />
        </div>

        <div className="card card-pad">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>{t("login_title")}</h1>
          <p className="t-muted fs-13" style={{ marginBottom: 22 }}>
            {t("login_sub")}
          </p>

          {needsSetup && (
            <div
              className="card card-pad"
              style={{
                marginBottom: 18,
                background: "rgba(255,197,49,.07)",
                borderColor: "rgba(255,197,49,.25)",
              }}
            >
              <div className="fw-6 fs-14" style={{ marginBottom: 6 }}>
                {lang === "ar" ? "أول مرة تشغّل النظام" : "First run"}
              </div>
              <p className="fs-13 t-2" style={{ marginBottom: 12 }}>
                {lang === "ar"
                  ? "هننشئ جداول قاعدة البيانات وحساب الأدمن الأول."
                  : "We'll create the database tables and the first admin account."}
              </p>
              <button className="btn btn-primary btn-sm btn-block" onClick={runSetup} disabled={busy}>
                {busy ? <span className="spinner" /> : null}
                {lang === "ar" ? "تجهيز النظام" : "Initialise system"}
              </button>
            </div>
          )}

          <form onSubmit={submit} className="col gap-16">
            <div className="field">
              <label className="label" htmlFor="u">
                {t("username")}
              </label>
              <div style={{ position: "relative" }}>
                <User
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
                  id="u"
                  className="input"
                  style={{ paddingInlineStart: 40 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="p">
                {t("password")}
              </label>
              <div style={{ position: "relative" }}>
                <Lock
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
                  id="p"
                  className="input"
                  style={{ paddingInlineStart: 40 }}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {err && (
              <div
                className="fs-13"
                style={{
                  padding: "10px 13px",
                  borderRadius: 9,
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  border: "1px solid rgba(251,113,133,.25)",
                }}
              >
                {err}
              </div>
            )}

            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? t("signing") : t("signin")}
              {!busy && <Arrow />}
            </button>
          </form>

          <div className="divider" />
          <div className="fs-12 t-muted center">
            {t("demo_hint")}: <b className="mono">admin</b> / <b className="mono">thunder123</b>
          </div>
        </div>

        <div className="center mt-16">
          <Link href="/" className="fs-13 t-muted">
            ← {t("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
