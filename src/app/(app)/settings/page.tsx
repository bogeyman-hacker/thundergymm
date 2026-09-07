"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Loading, PageHead } from "@/components/ui";
import { Check, Gear, Lock, Whats } from "@/components/Icons";

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [s, setS] = useState<Record<string, string> | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await api.get<{ settings: Record<string, string> }>("/api/settings");
      if (r.ok) setS(r.settings);
    })();
  }, []);

  async function save(extra: Record<string, any> = {}) {
    if (!s) return;
    setBusy(true);
    const r = await api.post<{ settings: Record<string, string> }>("/api/settings", { ...s, ...extra });
    setBusy(false);
    if (r.ok) {
      setS(r.settings);
      setPw("");
      toast(t("saved"));
    } else toast(r.error, "err");
  }

  if (!s) return <Loading />;

  const set = (k: string, v: string) => setS({ ...s, [k]: v });

  return (
    <>
      <PageHead title={t("settings_title")} sub={t("settings_sub")} />

      <div style={{ maxWidth: 680 }} className="col gap-16">
        <div className="card card-pad anim-up">
          <div className="row gap-8" style={{ marginBottom: 18 }}>
            <Gear width={17} height={17} style={{ color: "var(--gold)" }} />
            <b className="fs-15">{t("settings_title")}</b>
          </div>

          <div className="col gap-16">
            <div className="field">
              <label className="label">{t("gym_name")}</label>
              <input className="input" value={s.gym_name ?? ""} onChange={(e) => set("gym_name", e.target.value)} />
            </div>

            <div className="field">
              <label className="label">
                <Whats
                  width={13}
                  height={13}
                  style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 5, color: "#25D366" }}
                />
                {t("admin_phone")}
              </label>
              <input
                className="input mono"
                dir="ltr"
                placeholder="201012345678"
                value={s.admin_phone ?? ""}
                onChange={(e) => set("admin_phone", e.target.value)}
              />
              <span className="hint">{t("admin_phone_hint")}</span>
            </div>

            <div className="field">
              <label className="label">{t("msg_lang")}</label>
              <div className="seg">
                <button
                  type="button"
                  className={s.msg_lang !== "en" ? "on" : ""}
                  onClick={() => set("msg_lang", "ar")}
                >
                  العربية
                </button>
                <button
                  type="button"
                  className={s.msg_lang === "en" ? "on" : ""}
                  onClick={() => set("msg_lang", "en")}
                >
                  English
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">{t("dup_window")}</label>
              <input
                className="input num"
                type="number"
                min={0}
                max={120}
                dir="ltr"
                value={s.dup_window_min ?? "2"}
                onChange={(e) => set("dup_window_min", e.target.value)}
              />
              <span className="hint">
                {lang === "ar"
                  ? "لو العميل عمل سكان تاني خلال المدة دي، مش هيتسجل دخول جديد."
                  : "A second scan inside this window won't create a new check-in."}
              </span>
            </div>

            <button className="btn btn-primary" onClick={() => save()} disabled={busy}>
              {busy ? <span className="spinner" /> : <Check />}
              {t("save")}
            </button>
          </div>
        </div>

        <div className="card card-pad anim-up d2">
          <div className="row gap-8" style={{ marginBottom: 18 }}>
            <Lock width={17} height={17} style={{ color: "var(--gold)" }} />
            <b className="fs-15">{t("account")}</b>
          </div>

          <div className="field">
            <label className="label">{t("new_pw")}</label>
            <input
              className="input"
              type="password"
              dir="ltr"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button
            className="btn btn-ghost mt-16"
            onClick={() => save({ newPassword: pw })}
            disabled={busy || pw.length < 6}
          >
            <Check />
            {t("change_pw")}
          </button>
        </div>
      </div>
    </>
  );
}
