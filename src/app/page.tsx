"use client";

import Link from "next/link";
import { useI18n, LangToggle } from "@/components/I18nProvider";
import {
  Bolt, QrIcon, Camera, Clock, Whats, Bell, Calendar, ChevronL, ChevronR,
} from "@/components/Icons";

export default function Landing() {
  const { t, lang, dir } = useI18n();
  const Arrow = dir === "rtl" ? ChevronL : ChevronR;

  const features = [
    { I: QrIcon, t: t("f1_t"), d: t("f1_d") },
    { I: Camera, t: t("f2_t"), d: t("f2_d") },
    { I: Clock, t: t("f3_t"), d: t("f3_d") },
    { I: Whats, t: t("f4_t"), d: t("f4_d") },
    { I: Bell, t: t("f5_t"), d: t("f5_d") },
    { I: Calendar, t: t("f6_t"), d: t("f6_d") },
  ];

  const steps = [
    { n: 1, t: t("how_1_t"), d: t("how_1_d") },
    { n: 2, t: t("how_2_t"), d: t("how_2_d") },
    { n: 3, t: t("how_3_t"), d: t("how_3_d") },
  ];

  return (
    <div className="lp">
      {/* ── nav ─────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="logo">
          <Bolt />
        </div>
        <div className="grow">
          <div className="brandname">
            {lang === "ar" ? (
              <>ثاندر<span>جيم</span></>
            ) : (
              <>Thunder<span>Gym</span></>
            )}
          </div>
        </div>
        <LangToggle />
        <Link href="/login" className="btn btn-primary btn-sm">
          {t("cta_login")}
        </Link>
      </header>

      {/* ── hero ────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="anim-up">
          <span className="pill">
            <i />
            {t("hero_badge")}
          </span>
        </div>

        <h1 className="lp-title anim-up d1">
          {t("hero_title_1")} <em>{t("hero_title_2")}</em> {t("hero_title_3")}
        </h1>

        <p className="lp-sub anim-up d2">{t("hero_sub")}</p>

        <div className="lp-cta anim-up d3">
          <Link href="/login" className="btn btn-primary btn-lg">
            {t("cta_login")}
            <Arrow />
          </Link>
          <a href="#how" className="btn btn-ghost btn-lg">
            {t("cta_learn")}
          </a>
        </div>

        {/* ── product mock ──────────────────────────────── */}
        <div className="lp-mock">
          <div className="mockframe">
            <div className="mockbar">
              <u style={{ background: "#FF5F57" }} />
              <u style={{ background: "#FEBC2E" }} />
              <u style={{ background: "#28C840" }} />
              <span className="fs-11 t-muted" style={{ marginInlineStart: 10 }}>
                thundergym.app/scan
              </span>
            </div>
            <div className="mockbody">
              {/* fake scanner */}
              <div
                style={{
                  position: "relative",
                  borderRadius: 18,
                  background: "#05070B",
                  border: "1px solid var(--line)",
                  aspectRatio: "1",
                  overflow: "hidden",
                }}
              >
                <div className="scan-frame">
                  <i /><i /><i /><i />
                  <u />
                </div>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", opacity: 0.5 }}>
                  <QrIcon width={64} height={64} style={{ color: "var(--gold)" }} />
                </div>
              </div>

              {/* fake result */}
              <div className="col gap-12">
                <div className="result ok" style={{ padding: 20 }}>
                  <div className="ring" style={{ width: 104, height: 104, margin: "0 auto 10px" }}>
                    <svg viewBox="0 0 120 120">
                      <circle className="track" cx="60" cy="60" r="52" />
                      <circle
                        className="val"
                        cx="60" cy="60" r="52"
                        stroke="var(--ok)"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - 0.62)}
                      />
                    </svg>
                    <div className="ring-mid">
                      <b className="num">18</b>
                      <small>{t("days_left_label")}</small>
                    </div>
                  </div>
                  <div className="fw-7" style={{ fontSize: 16 }}>
                    {lang === "ar" ? "أحمد محمود" : "Ahmed Mahmoud"}
                  </div>
                  <div className="fs-12 t-muted mono">TG-000147</div>
                </div>
                <button className="btn btn-wa btn-block" tabIndex={-1}>
                  <Whats />
                  {t("send_wa")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── features ────────────────────────────────────── */}
      <section className="lp-section">
        <div className="features">
          {features.map((f, i) => (
            <div className="feature" key={i}>
              <div className="feature-ico">
                <f.I />
              </div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── how ─────────────────────────────────────────── */}
      <section className="lp-section" id="how">
        <h2>{t("how_title")}</h2>
        <div className="steps">
          {steps.map((s) => (
            <div className="step" key={s.n}>
              <div className="step-n num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <div className="center mt-32">
          <Link href="/login" className="btn btn-primary btn-lg">
            {t("cta_login")}
            <Arrow />
          </Link>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="row gap-8">
          <div className="logo" style={{ width: 28, height: 28, borderRadius: 8 }}>
            <Bolt width={15} height={15} />
          </div>
          <span>
            <b>ThunderGym</b> — {t("footer_note")}
          </span>
        </div>
        <span className="num">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
