"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { PageHead } from "@/components/ui";
import { Check, ChevronL, ChevronR } from "@/components/Icons";

type Plan = {
  id: number;
  name_ar: string;
  name_en: string;
  duration_days: number;
  price: string;
  active: 0 | 1;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function NewMemberPage() {
  const { t, lang, dir } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const Back = dir === "rtl" ? ChevronR : ChevronL;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [f, setF] = useState({
    name: "",
    phone: "",
    gender: "male" as "male" | "female",
    birthDate: "",
    notes: "",
    planId: "" as string,
    customDays: "",
    startDate: todayISO(),
    price: "",
    paid: "",
  });

  useEffect(() => {
    (async () => {
      const r = await api.get<{ plans: Plan[] }>("/api/plans");
      if (r.ok) {
        const act = r.plans.filter((p) => p.active);
        setPlans(act);
        const monthly = act.find((p) => p.duration_days === 30) ?? act[0];
        if (monthly)
          setF((p) => ({ ...p, planId: String(monthly.id), price: String(Number(monthly.price)) }));
      }
    })();
  }, []);

  function pickPlan(id: string) {
    const p = plans.find((x) => String(x.id) === id);
    setF((s) => ({
      ...s,
      planId: id,
      price: p ? String(Number(p.price)) : s.price,
      customDays: id === "custom" ? s.customDays : "",
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || !f.phone.trim()) {
      setErr(t("required"));
      return;
    }
    setBusy(true);

    const payload: any = {
      name: f.name,
      phone: f.phone,
      gender: f.gender,
      birthDate: f.birthDate || null,
      notes: f.notes,
      startDate: f.startDate,
      price: f.price === "" ? 0 : Number(f.price),
      paid: f.paid === "" ? Number(f.price || 0) : Number(f.paid),
    };

    if (f.planId === "custom") {
      payload.durationDays = Number(f.customDays);
      payload.planLabel =
        lang === "ar" ? `مخصص ${f.customDays} يوم` : `Custom ${f.customDays} days`;
    } else {
      payload.planId = Number(f.planId);
    }

    const r = await api.post<{ member: { id: number } }>("/api/members", payload);
    setBusy(false);
    if (r.ok) {
      toast(lang === "ar" ? "تم تسجيل العميل ✅" : "Member registered ✅");
      router.push(`/members/${r.member.id}?new=1`);
    } else setErr(r.error);
  }

  const selected = plans.find((p) => String(p.id) === f.planId);

  return (
    <>
      <PageHead
        title={t("new_title")}
        sub={t("new_sub")}
        right={
          <Link href="/members" className="btn btn-ghost">
            <Back />
            {t("back")}
          </Link>
        }
      />

      <form onSubmit={submit} style={{ maxWidth: 760 }}>
        <div className="card card-pad anim-up">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label">{t("full_name")} *</label>
              <input
                className="input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label className="label">{t("phone")} *</label>
              <input
                className="input mono"
                dir="ltr"
                placeholder="01012345678"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
                required
              />
              <span className="hint">{t("phone_hint")}</span>
            </div>

            <div className="field">
              <label className="label">{t("gender")}</label>
              <div className="seg" style={{ height: 44, alignItems: "center" }}>
                <button
                  type="button"
                  className={f.gender === "male" ? "on" : ""}
                  onClick={() => setF({ ...f, gender: "male" })}
                >
                  {t("male")}
                </button>
                <button
                  type="button"
                  className={f.gender === "female" ? "on" : ""}
                  onClick={() => setF({ ...f, gender: "female" })}
                >
                  {t("female")}
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">{t("birth_date")}</label>
              <input
                className="input"
                type="date"
                dir="ltr"
                value={f.birthDate}
                onChange={(e) => setF({ ...f, birthDate: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="label">{t("start_date")}</label>
              <input
                className="input"
                type="date"
                dir="ltr"
                value={f.startDate}
                onChange={(e) => setF({ ...f, startDate: e.target.value })}
              />
            </div>
          </div>

          <div className="divider" />

          <div className="form-grid">
            <div className="field span-2">
              <label className="label">{t("plan")}</label>
              <select className="select" value={f.planId} onChange={(e) => pickPlan(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {lang === "ar" ? p.name_ar : p.name_en} — {p.duration_days} {t("days")} ·{" "}
                    {Number(p.price)} {t("egp")}
                  </option>
                ))}
                <option value="custom">
                  {lang === "ar" ? "مدة مخصصة…" : "Custom duration…"}
                </option>
              </select>
            </div>

            {f.planId === "custom" && (
              <div className="field span-2">
                <label className="label">{t("custom_days")} *</label>
                <input
                  className="input num"
                  type="number"
                  min={1}
                  max={3650}
                  dir="ltr"
                  value={f.customDays}
                  onChange={(e) => setF({ ...f, customDays: e.target.value })}
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
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="label">{t("paid")}</label>
              <input
                className="input num"
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                placeholder={f.price || "0"}
                value={f.paid}
                onChange={(e) => setF({ ...f, paid: e.target.value })}
              />
            </div>

            <div className="field span-2">
              <label className="label">{t("notes")}</label>
              <textarea
                className="textarea"
                value={f.notes}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </div>
          </div>

          {selected && f.planId !== "custom" && (
            <div
              className="fs-13 t-2 mt-16"
              style={{
                padding: "11px 14px",
                borderRadius: 10,
                background: "var(--gold-soft)",
                border: "1px solid rgba(255,197,49,.2)",
              }}
            >
              {lang === "ar"
                ? `المدة ${selected.duration_days} يوم — النظام هيبعتلك تنبيه في المنتصف وقبل الانتهاء.`
                : `${selected.duration_days} days — you'll get a half-way and an expiring alert.`}
            </div>
          )}

          {err && (
            <div
              className="fs-13 mt-16"
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

          <div className="row gap-10 mt-24">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : <Check />}
              {busy ? t("saving") : t("save")}
            </button>
            <Link href="/members" className="btn btn-outline">
              {t("cancel")}
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}
