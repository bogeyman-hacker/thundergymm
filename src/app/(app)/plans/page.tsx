"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { Empty, Loading, PageHead } from "@/components/ui";
import { Plus, Check, Trash, X } from "@/components/Icons";

type Plan = {
  id: number;
  name_ar: string;
  name_en: string;
  duration_days: number;
  price: string;
  color: string;
  active: 0 | 1;
};

export default function PlansPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ nameAr: "", nameEn: "", durationDays: "30", price: "0", color: "#FFC531" });

  async function load() {
    const r = await api.get<{ plans: Plan[] }>("/api/plans");
    if (r.ok) setPlans(r.plans);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api.post("/api/plans", {
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      durationDays: Number(f.durationDays),
      price: Number(f.price),
      color: f.color,
    });
    setBusy(false);
    if (r.ok) {
      toast(t("plan_saved"));
      setOpen(false);
      setF({ nameAr: "", nameEn: "", durationDays: "30", price: "0", color: "#FFC531" });
      load();
    } else toast(r.error, "err");
  }

  async function toggle(p: Plan) {
    await api.patch("/api/plans", { id: p.id, active: !p.active });
    load();
  }

  async function remove(p: Plan) {
    if (!confirm(lang === "ar" ? "حذف الباقة؟" : "Delete this plan?")) return;
    const r = await api.del(`/api/plans?id=${p.id}`);
    if (r.ok) load();
    else toast(r.error, "err");
  }

  async function editField(p: Plan, key: "price" | "duration_days", value: string) {
    const payload: any = { id: p.id };
    if (key === "price") payload.price = Number(value);
    else payload.durationDays = Number(value);
    await api.patch("/api/plans", payload);
    load();
  }

  return (
    <>
      <PageHead
        title={t("plans_title")}
        sub={t("plans_sub")}
        right={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus />
            {t("add_plan")}
          </button>
        }
      />

      {!plans ? (
        <Loading />
      ) : plans.length === 0 ? (
        <div className="card">
          <Empty text={t("no_data")} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))", gap: 14 }}>
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={`card card-pad anim-up d${(i % 6) + 1}`}
              style={{ opacity: p.active ? 1 : 0.5, borderColor: p.active ? "var(--line)" : "var(--line)" }}
            >
              <div className="row-b" style={{ marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `${p.color}22`,
                    border: `1px solid ${p.color}44`,
                    display: "grid",
                    placeItems: "center",
                    color: p.color,
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                  className="num"
                >
                  {p.duration_days}
                </div>
                <button
                  className={`btn btn-sm ${p.active ? "btn-outline" : "btn-ghost"}`}
                  onClick={() => toggle(p)}
                >
                  {p.active ? <Check /> : <X />}
                  {t("active_q")}
                </button>
              </div>

              <div className="fw-7 fs-18">{lang === "ar" ? p.name_ar : p.name_en}</div>
              <div className="fs-12 t-muted">{lang === "ar" ? p.name_en : p.name_ar}</div>

              <div className="divider" />

              <div className="col gap-10">
                <div className="field">
                  <label className="label">{t("duration_days")}</label>
                  <input
                    className="input num"
                    type="number"
                    min={1}
                    dir="ltr"
                    defaultValue={p.duration_days}
                    onBlur={(e) =>
                      Number(e.target.value) !== p.duration_days &&
                      editField(p, "duration_days", e.target.value)
                    }
                  />
                </div>
                <div className="field">
                  <label className="label">
                    {t("price")} ({t("egp")})
                  </label>
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    defaultValue={Number(p.price)}
                    onBlur={(e) =>
                      Number(e.target.value) !== Number(p.price) && editField(p, "price", e.target.value)
                    }
                  />
                </div>
              </div>

              <button className="btn btn-danger btn-sm btn-block mt-16" onClick={() => remove(p)}>
                <Trash />
                {t("del")}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
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
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            className="card card-pad anim-pop"
            style={{ width: "min(430px, 100%)", background: "var(--elev)" }}
            onSubmit={create}
          >
            <div className="row-b" style={{ marginBottom: 18 }}>
              <h3 className="fs-18">{t("add_plan")}</h3>
              <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>

            <div className="col gap-16">
              <div className="field">
                <label className="label">{t("name_ar")}</label>
                <input className="input" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">{t("name_en")}</label>
                <input
                  className="input"
                  dir="ltr"
                  value={f.nameEn}
                  onChange={(e) => setF({ ...f, nameEn: e.target.value })}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label className="label">{t("duration_days")}</label>
                  <input
                    className="input num"
                    type="number"
                    min={1}
                    dir="ltr"
                    value={f.durationDays}
                    onChange={(e) => setF({ ...f, durationDays: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">{t("price")}</label>
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    dir="ltr"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                  />
                </div>
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
