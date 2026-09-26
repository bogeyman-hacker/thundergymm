"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { PageHead, Loading } from "@/components/ui";
import { Users, Plus, QrIcon, Check, X, Printer, Download } from "@/components/Icons";

type Staff = { id: number; serial: string; full_name: string; phone: string; job_title: string;
  monthly_salary: string; active: number; open_shift: number | null };
type Shift = { id: number; staff_id: number; full_name: string; serial: string;
  clock_in: string; clock_out: string | null };

export default function StaffPage() {
  const { lang, fmtDateTime } = useI18n();
  const toast = useToast();
  const ar = lang === "ar";
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", jobTitle: "", monthlySalary: "" });
  const [selected, setSelected] = useState<Staff | null>(null);
  const [qr, setQr] = useState("");

  const load = useCallback(async () => {
    const r = await api.get<{ staff: Staff[]; attendance: Shift[] }>("/api/staff");
    if (r.ok) { setStaff(r.staff); setShifts(r.attendance); }
    else toast(r.error, "err");
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = editing
      ? await api.patch("/api/staff", { id: editing.id, ...form, monthlySalary: Number(form.monthlySalary || 0) })
      : await api.post<{ id: number }>("/api/staff", { ...form, monthlySalary: Number(form.monthlySalary || 0) });
    setBusy(false);
    if (!r.ok) return toast(r.error, "err");
    toast(ar ? "تم إضافة الموظف" : "Staff added", "ok");
    setAdding(false); setEditing(null); setForm({ name: "", phone: "", jobTitle: "", monthlySalary: "" });
    load();
  }
  async function toggle(s: Staff) {
    const r = await api.patch("/api/staff", { id: s.id, active: !s.active });
    if (r.ok) load(); else toast(r.error, "err");
  }
  async function viewQr(s: Staff) {
    setSelected(s); setQr("");
    const r = await api.get<{ dataUrl: string }>(`/api/staff/${s.id}/qr?size=560`);
    if (r.ok) setQr(r.dataUrl); else toast(r.error, "err");
  }

  if (loading) return <Loading />;
  return <>
    <PageHead title={ar ? "الموظفين" : "Staff"}
      sub={ar ? "QR مستقل لكل موظف، حضور وانصراف، وسجل الدوام" : "Dedicated staff QR, clock-in/out and shift history"}
      right={<button className="btn btn-primary" onClick={() => {setEditing(null);setForm({name:"",phone:"",jobTitle:"",monthlySalary:""});setAdding(true);}}><Plus />{ar ? "موظف جديد" : "Add staff"}</button>} />

    <div className="card anim-up">
      <div className="card-head"><h3><Users width={18} height={18} /> {ar ? "فريق الجيم" : "Gym team"}</h3>
        <span className="badge b-active num">{staff.length}</span></div>
      {!staff.length ? <div className="empty">{ar ? "ضيف أول موظف عشان تطبع له كود" : "Add a team member to print a QR code"}</div> :
        <div className="table-wrap"><table className="tg"><thead><tr>
          <th>{ar ? "الاسم" : "Name"}</th><th>{ar ? "الوظيفة" : "Job"}</th>
          <th>{ar ? "الكود" : "Code"}</th><th>{ar ? "المرتب المسجل" : "Salary target"}</th>
          <th>{ar ? "الدوام" : "Shift"}</th><th>{ar ? "إجراء" : "Action"}</th>
        </tr></thead><tbody>{staff.map(s => <tr key={s.id}>
          <td><b>{s.full_name}</b><div className="fs-11 t-muted" dir="ltr">{s.phone}</div></td>
          <td className="t-2">{s.job_title || "—"}</td>
          <td className="mono fs-12">{s.serial}</td>
          <td className="num">{Number(s.monthly_salary).toLocaleString()} {ar ? "ج.م" : "EGP"}</td>
          <td><span className={`badge ${s.open_shift ? "b-active" : "b-expired"}`}>
            {s.open_shift ? (ar ? "حاضر" : "Clocked in") : (ar ? "خارج" : "Out")}</span></td>
          <td><div className="row gap-8 wrap"><button className="btn btn-outline btn-sm" onClick={() => viewQr(s)}><QrIcon />QR</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setEditing(s); setForm({name:s.full_name, phone:s.phone, jobTitle:s.job_title,
                                    monthlySalary:String(Number(s.monthly_salary))}); setAdding(true);
            }}>{ar ? "تعديل" : "Edit"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(s)}>
              {s.active ? (ar ? "تعطيل" : "Disable") : (ar ? "تفعيل" : "Enable")}</button></div></td>
        </tr>)}</tbody></table></div>}
    </div>

    <div className="card mt-24 anim-up">
      <div className="card-head"><h3>{ar ? "آخر عمليات الحضور والانصراف" : "Recent staff shifts"}</h3>
        <Link href="/scan" className="btn btn-outline btn-sm"><QrIcon />{ar ? "افتح المسح" : "Open scanner"}</Link></div>
      {!shifts.length ? <div className="empty">{ar ? "مفيش حضور مسجّل" : "No shifts recorded"}</div> :
        <div className="table-wrap"><table className="tg"><thead><tr>
          <th>{ar ? "الموظف" : "Staff"}</th><th>{ar ? "الحضور" : "In"}</th><th>{ar ? "الانصراف" : "Out"}</th>
        </tr></thead><tbody>{shifts.map(a => <tr key={a.id}>
          <td><b>{a.full_name}</b> <span className="mono fs-11 t-muted">{a.serial}</span></td>
          <td className="num fs-12">{fmtDateTime(a.clock_in)}</td>
          <td className="num fs-12">{a.clock_out ? fmtDateTime(a.clock_out) : (ar ? "لسه حاضر" : "Still in")}</td>
        </tr>)}</tbody></table></div>}
      <div className="card-pad fs-12 t-muted">{ar
        ? "تسجيل المرتبات المدفوعة فعليًا من صفحة المالية ← المصروفات (مرتب). المرتب المكتوب هنا للمرجعية فقط."
        : "Record actual salary payments in Finance → Expenses (Salary). The target above is informational."}</div>
    </div>

    {adding && <div className="modal-backdrop" style={{position:"fixed",inset:0,zIndex:300,display:"grid",placeItems:"center",padding:20,background:"rgba(0,0,0,.7)"}} onClick={e=>e.target===e.currentTarget&&setAdding(false)}>
      <form className="card card-pad anim-pop" style={{width:"min(460px,100%)",background:"var(--elev)"}} onSubmit={create}>
        <div className="row-b"><h3>{editing ? (ar ? "تعديل الموظف" : "Edit staff") : (ar ? "موظف جديد" : "New staff")}</h3><button type="button" className="btn btn-ghost btn-icon" onClick={()=>setAdding(false)}><X /></button></div>
        <div className="col gap-16 mt-16">
          {([["name",ar?"الاسم":"Name"],["phone",ar?"الموبايل":"Phone"],["jobTitle",ar?"الوظيفة":"Job title"],["monthlySalary",ar?"المرتب الشهري (مرجعي)":"Monthly salary (reference)"]] as const).map(([key,label]) =>
            <div className="field" key={key}><label className="label">{label}</label><input className="input" required={key==="name"}
              type={key==="monthlySalary"?"number":"text"} min={key==="monthlySalary"?0:undefined} step={key==="monthlySalary"?"0.01":undefined}
              value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></div>)}
          <button className="btn btn-primary" disabled={busy}>{busy?<span className="spinner"/>:<Check />}{editing ? (ar?"حفظ التعديل":"Save changes") : (ar?"حفظ وإنشاء QR":"Save and create QR")}</button>
        </div>
      </form>
    </div>}
    {selected && <div style={{position:"fixed",inset:0,zIndex:310,display:"grid",placeItems:"center",padding:16,background:"rgba(0,0,0,.78)"}} onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
      <div className="card card-pad staff-print" style={{width:"min(420px,100%)",textAlign:"center",background:"var(--elev)"}}>
        <div className="row-b" style={{marginBottom:10}}><b className="fs-18">Thunder<span style={{color:"#FFC531"}}>Gym</span> · Staff</b>
          <button className="btn btn-outline btn-sm btn-icon" onClick={()=>setSelected(null)}><X /></button></div>
        <h3>{selected.full_name}</h3><p className="t-muted fs-12">{selected.job_title}</p>
        {qr ? <img src={qr} alt={`QR ${selected.serial}`} style={{width:245,maxWidth:"100%",margin:"16px auto",borderRadius:12}} /> : <div className="spinner" />}
        <div className="mono fs-16 fw-7">{selected.serial}</div>
        <p className="hint mt-8">{ar?"كارت حضور وانصراف للموظف — لا يستخدم كاشتراك عميل":"Staff clock-in/out card — not a member subscription"}</p>
        <div className="row gap-8 mt-16" style={{justifyContent:"center"}}>
          {qr && <a className="btn btn-primary" href={qr} download={`${selected.serial}.png`}><Download />{ar?"تحميل QR":"Download QR"}</a>}
          <button className="btn btn-outline" onClick={()=>window.print()}><Printer />{ar?"طباعة":"Print"}</button>
        </div>
      </div>
      <style>{`@media print{body *{visibility:hidden!important}.staff-print,.staff-print *{visibility:visible!important}.staff-print{position:absolute;inset:0;background:white!important;color:black!important;box-shadow:none!important}}`}</style>
    </div>}
  </>;
}
