"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/Toast";
import { PageHead, Loading } from "@/components/ui";
import { Wallet, Trending, Plus, X, Check } from "@/components/Icons";

type Row = Record<string, any>;
type Finance = {
  month: string;
  summary: Record<string, number>;
  payments: Row[]; expenses: Row[]; purchases: Row[]; sales: Row[];
  products: Row[]; staff: Row[]; debtors: Row[];
};
type Action = "payment" | "expense" | "product" | "price" | "purchase" | "sale";
const label = (ar: boolean, a: string, e: string) => ar ? a : e;
const amount = (n: number | string) => `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function FinancePage() {
  const { lang, fmtDateTime } = useI18n();
  const ar = lang === "ar";
  const toast = useToast();
  const [month, setMonth] = useState(() => {
    const p = new Intl.DateTimeFormat("en-US", {timeZone:"Africa/Cairo",year:"numeric",month:"2-digit"}).formatToParts(new Date());
    return `${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}`;
  });
  const [data, setData] = useState<Finance | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [tab, setTab] = useState<"payments" | "expenses" | "stock" | "sales">("payments");
  const [f, setF] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await api.get<Finance>(`/api/finance?month=${month}`);
    if (r.ok) setData(r as any); else toast(r.error, "err");
  }, [month, toast]);
  useEffect(() => { load(); }, [load]);

  function open(a: Action, initial: Record<string, string> = {}) {
    setAction(a); setF(initial);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    const payload: Record<string, any> = { action, ...f };
    for (const k of ["productId", "subscriptionId", "staffId", "quantity", "amount", "unitCost", "unitPrice", "salePrice"])
      if (f[k] !== undefined && f[k] !== "") payload[k] = Number(f[k]);
    const r = await api.post("/api/finance", payload);
    setBusy(false);
    if (!r.ok) return toast(r.error, "err");
    toast(label(ar, "اتسجلت العملية بنجاح", "Transaction recorded"), "ok");
    setAction(null); setF({}); load();
  }
  const input = (key: string, title: string, opts: { type?: string; required?: boolean; min?: number; step?: string; placeholder?: string } = {}) =>
    <div className="field" key={key}><label className="label">{title}</label>
      <input className="input" type={opts.type || "text"} required={opts.required}
        min={opts.min} step={opts.step} placeholder={opts.placeholder}
        dir={opts.type === "number" ? "ltr" : undefined}
        value={f[key] ?? ""} onChange={e => setF({ ...f, [key]: e.target.value })} /></div>;
  const select = (key: string, title: string, choices: { value: string; title: string }[], required = true) =>
    <div className="field" key={key}><label className="label">{title}</label><select className="select" required={required}
      value={f[key] ?? ""} onChange={e=>setF({...f,[key]:e.target.value})}>
      <option value="">{label(ar, "اختر…", "Select…")}</option>
      {choices.map(c=><option key={c.value} value={c.value}>{c.title}</option>)}
    </select></div>;

  if (!data) return <Loading />;
  const s = data.summary;
  const currency = label(ar, "ج.م", "EGP");
  const cards = [
    { k: "newMembers", a: "اشتراكات جديدة", e: "New members", c: "var(--gold)" },
    { k: "renewals", a: "تجديدات", e: "Renewals", c: "var(--info)" },
    { k: "arrears", a: "دفعات باقي الاشتراكات", e: "Later payments", c: "var(--violet)" },
    { k: "salesIncome", a: "مبيعات منتجات", e: "Product sales", c: "var(--ok)" },
    { k: "totalOut", a: "الخارج نقدًا", e: "Cash out", c: "var(--danger)" },
    { k: "cashNet", a: "صافي الكاش", e: "Cash balance", c: "var(--gold)" },
    { k: "profit", a: "ربح تشغيلي تقديري", e: "Estimated operating profit", c: "var(--ok)" },
    { k: "outstanding", a: "باقي على العملاء", e: "Unpaid by members", c: "var(--warn)" },
  ];
  const titles: Record<Action, [string,string]> = {
    payment: ["تسجيل دفعة من عميل", "Record member payment"],
    expense: ["تسجيل مصروف", "Record expense"],
    product: ["إضافة منتج", "Add product"],
    price: ["تغيير سعر بيع منتج", "Update product sale price"],
    purchase: ["شراء مخزون", "Buy stock"],
    sale: ["بيع منتج", "Sell product"],
  };

  return <>
    <PageHead title={label(ar, "المالية والمخزون", "Finance & inventory")}
      sub={label(ar, "كل جنيه داخل وخارج — بدون خلط المصروفات بتكلفة البضاعة المباعة", "Every cash movement, with inventory cost accounted for separately")}
      right={<input className="input mono" style={{maxWidth:180}} type="month" value={month} onChange={e=>{setData(null);setMonth(e.target.value);}} />} />
    <div className="row gap-8 wrap mt-16">
      <button className="btn btn-primary" onClick={()=>open("payment")}><Plus />{label(ar,"دفعة عميل","Member payment")}</button>
      <button className="btn btn-outline" onClick={()=>open("expense")}><Plus />{label(ar,"مصروف / مرتب","Expense / salary")}</button>
      <button className="btn btn-outline" onClick={()=>open("product")}><Plus />{label(ar,"منتج جديد","New product")}</button>
      <button className="btn btn-outline" onClick={()=>open("purchase")}><Plus />{label(ar,"شراء مخزون","Buy stock")}</button>
      <button className="btn btn-outline" onClick={()=>open("sale")}><Plus />{label(ar,"تسجيل بيع","Record sale")}</button>
    </div>

    <div className="finance-stats mt-24">
      {cards.map(c => <div className="card card-pad" key={c.k} style={{borderTop:`2px solid ${c.c}`}}>
        <div className="fs-12 t-muted">{label(ar,c.a,c.e)}</div>
        <div className="num fw-7 mt-8" style={{fontSize:23,color:c.c}}>{amount(s[c.k])} <small className="fs-12">{currency}</small></div>
      </div>)}
    </div>
    <div className="card card-pad mt-16 fs-12 t-2" style={{lineHeight:1.9}}>
      <Trending width={15} height={15} style={{verticalAlign:-3,marginInlineEnd:5}}/>
      {ar
        ? <>الداخل = اشتراكات ({amount(s.memberIncome)}) + مبيعات ({amount(s.salesIncome)}). الخارج نقدًا = مصروفات ({amount(s.operatingOut)}) + مشتريات مخزون ({amount(s.inventoryOut)}). صافي الكاش = الداخل − الخارج. الربح التشغيلي التقديري يخصم تكلفة المنتجات <b>اللي اتباعت فقط</b> ({amount(s.cogs)}) بدل تكلفة كل المخزون المشترى؛ عشان ما يتحسبش مرتين.</>
        : <>Cash in = memberships ({amount(s.memberIncome)}) + sales ({amount(s.salesIncome)}). Cash out = expenses ({amount(s.operatingOut)}) + inventory purchases ({amount(s.inventoryOut)}). Accounting profit deducts the cost of <b>sold items only</b> ({amount(s.cogs)}), avoiding double-counting inventory.</>}
    </div>

    <div className="row gap-8 wrap mt-24">
      {([ ["payments", "دفعات العملاء", "Payments"], ["expenses", "المصروفات", "Expenses"],
          ["stock", "المخزون والمشتريات", "Stock & purchases"], ["sales", "المبيعات", "Sales"] ] as const).map(([key,a,e]) =>
        <button key={key} className={`btn ${tab===key?"btn-primary":"btn-ghost"}`} onClick={()=>setTab(key)}>
          {label(ar,a,e)}</button>)}
    </div>

    <div className="card mt-16">
      {tab==="payments" && <><div className="card-head"><h3>{label(ar,"إيراد العملاء","Membership income")}</h3></div>
        {!data.payments.length ? <div className="empty">{label(ar,"مفيش دفعات في الشهر ده","No payments this month")}</div> :
          <div className="table-wrap"><table className="tg"><thead><tr><th>{label(ar,"العميل","Member")}</th>
            <th>{label(ar,"النوع","Type")}</th><th>{label(ar,"المدفوع","Amount")}</th><th>{label(ar,"التاريخ","Date")}</th></tr></thead>
            <tbody>{data.payments.map(p=><tr key={p.id}><td>{p.member_name||`#${p.member_id}`}</td>
              <td>{p.kind==="new"?label(ar,"جديد","New"):p.kind==="renewal"?label(ar,"تجديد","Renewal"):label(ar,"دفعة باقية","Later payment")}</td>
              <td className="num">{amount(p.amount)} {currency}</td><td className="num fs-12">{fmtDateTime(p.paid_at)}</td></tr>)}</tbody>
          </table></div>}
        {!!data.debtors.length && <div className="card-pad" style={{borderTop:"1px solid var(--line)"}}>
          <b className="fs-13">{label(ar,"باقي على العملاء — سجّل دفعة من الزر فوق","Outstanding balances — use Member payment above")}</b>
          <div className="row gap-8 wrap mt-8">{data.debtors.map(d=><button key={d.subscription_id}
            className="btn btn-outline btn-sm" onClick={()=>open("payment",{subscriptionId:String(d.subscription_id),amount:String(Number(d.remaining))})}>
            {d.full_name} · <span className="num">{amount(d.remaining)} {currency}</span>
          </button>)}</div>
        </div>}
      </>}
      {tab==="expenses" && <><div className="card-head"><h3>{label(ar,"مصروفات الجيم والمرتبات","Gym expenses & salaries")}</h3></div>
        {!data.expenses.length ? <div className="empty">{label(ar,"مفيش مصروفات للشهر ده","No expenses this month")}</div> :
          <div className="table-wrap"><table className="tg"><thead><tr><th>{label(ar,"البند","Description")}</th>
          <th>{label(ar,"النوع","Category")}</th><th>{label(ar,"المدفوع","Paid")}</th><th>{label(ar,"التاريخ","Date")}</th></tr></thead>
          <tbody>{data.expenses.map(e=><tr key={e.id}><td>{e.description}{e.staff_name&&<div className="fs-11 t-muted">{e.staff_name}</div>}</td>
            <td>{ar ? ({salary:"مرتب",supplies:"مستلزمات",equipment:"معدات",utilities:"مرافق",rent:"إيجار",other:"أخرى"} as Record<string,string>)[e.category] || e.category : e.category}</td><td className="num">{amount(e.amount)} {currency}</td><td className="num fs-12">{fmtDateTime(e.paid_at)}</td></tr>)}</tbody></table></div>}
      </>}
      {tab==="stock" && <><div className="card-head"><h3>{label(ar,"المنتجات والرصيد","Products & stock")}</h3></div>
        {!data.products.length ? <div className="empty">{label(ar,"ضيف منتج مثل زجاج المياه، وبعدها سجل شراء كمية","Add a product (e.g. bottled water), then record a stock purchase")}</div> :
          <div className="table-wrap"><table className="tg"><thead><tr><th>{label(ar,"المنتج","Product")}</th>
            <th>{label(ar,"الكمية المتاحة","On hand")}</th><th>{label(ar,"متوسط التكلفة","Avg cost")}</th><th>{label(ar,"سعر البيع","Sale price")}</th><th></th></tr></thead>
            <tbody>{data.products.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td className="num">{p.stock}</td>
              <td className="num">{amount(p.avg_cost)} {currency}</td><td className="num">{amount(p.sale_price)} {currency}</td>
              <td><div className="row gap-6 wrap"><button className="btn btn-outline btn-sm" onClick={()=>open("purchase",{productId:String(p.id)})}>{label(ar,"اشتري","Buy")}</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>open("price",{productId:String(p.id),salePrice:String(Number(p.sale_price))})}>{label(ar,"السعر","Price")}</button></div></td>
            </tr>)}</tbody></table></div>}
        {!!data.purchases.length && <div className="card-pad"><h3 className="fs-14">{label(ar,"مشتريات المخزون خلال الشهر","Inventory purchases this month")}</h3>
          {data.purchases.map(x=><div key={x.id} className="row-b fs-12 mt-8" style={{borderBottom:"1px solid var(--line)",paddingBottom:8}}>
            <span>{x.product_name} · <span className="num">{x.quantity} × {amount(x.unit_cost)}</span></span>
            <b className="num">{amount(x.total_cost)} {currency}</b></div>)}
        </div>}
      </>}
      {tab==="sales" && <><div className="card-head"><h3>{label(ar,"مبيعات المنتجات","Product sales")}</h3></div>
        {!data.sales.length ? <div className="empty">{label(ar,"مفيش مبيعات منتجات الشهر ده","No product sales this month")}</div> :
          <div className="table-wrap"><table className="tg"><thead><tr><th>{label(ar,"المنتج","Product")}</th>
            <th>{label(ar,"الكمية","Qty")}</th><th>{label(ar,"الداخل","Revenue")}</th>
            <th>{label(ar,"التكلفة","Cost")}</th><th>{label(ar,"التاريخ","Date")}</th></tr></thead>
            <tbody>{data.sales.map(x=><tr key={x.id}><td>{x.product_name}</td><td className="num">{x.quantity}</td>
              <td className="num">{amount(x.total_amount)} {currency}</td><td className="num">{amount(x.cost_amount)} {currency}</td>
              <td className="num fs-12">{fmtDateTime(x.sold_at)}</td></tr>)}</tbody></table></div>}
      </>}
    </div>

    {action && <div style={{position:"fixed",inset:0,zIndex:300,display:"grid",placeItems:"center",padding:16,background:"rgba(0,0,0,.73)",backdropFilter:"blur(4px)"}}
      onClick={e=>e.target===e.currentTarget&&setAction(null)}>
      <form className="card card-pad anim-pop" style={{width:"min(465px,100%)",maxHeight:"85vh",overflowY:"auto",background:"var(--elev)"}} onSubmit={save}>
        <div className="row-b"><h3>{label(ar,...titles[action])}</h3><button type="button" className="btn btn-ghost btn-icon" onClick={()=>setAction(null)}><X /></button></div>
        <div className="col gap-16 mt-16">
          {action==="payment" && <>
            {select("subscriptionId",label(ar,"اشتراك عليه باقي","Outstanding subscription"),data.debtors.map(d=>({value:String(d.subscription_id),title:`${d.full_name} — ${amount(d.remaining)} ${currency}`})))}
            {input("amount",label(ar,"المبلغ المقبوض فعليًا","Cash received"),{type:"number",required:true,min:0.01,step:"0.01"})}
            {input("note",label(ar,"ملاحظة (اختياري)","Note (optional)"))}
          </>}
          {action==="expense" && <>
            {select("category",label(ar,"نوع المصروف","Category"),[
              ["salary",ar?"مرتب موظف":"Salary"],["supplies",ar?"مستلزمات":"Supplies"],
              ["equipment",ar?"معدات":"Equipment"],["utilities",ar?"مرافق":"Utilities"],
              ["rent",ar?"إيجار":"Rent"],["other",ar?"أخرى":"Other"],
            ].map(([value,title])=>({value,title})))}
            {f.category==="salary" && select("staffId",label(ar,"الموظف (اختياري)","Staff member (optional)"),
              data.staff.map(s=>({value:String(s.id),title:`${s.full_name} — ${amount(s.monthly_salary)} ${currency}`})), false)}
            {input("description",label(ar,"الوصف (مثلاً مرتب سبتمبر / شراء أدوات)","Description (e.g. September salary)"),{required:true})}
            {input("amount",label(ar,"المبلغ المدفوع","Amount paid"),{type:"number",min:0.01,step:"0.01",required:true})}
          </>}
          {action==="product" && <>
            {input("name",label(ar,"اسم المنتج (مثلاً زجاج مياه)","Product name (e.g. bottled water)"),{required:true})}
            {input("salePrice",label(ar,"سعر بيع القطعة","Unit sale price"),{type:"number",required:true,min:0,step:"0.01"})}
          </>}
          {action==="price" && <>
            {select("productId",label(ar,"المنتج","Product"),data.products.map(p=>({value:String(p.id),title:p.name})))}
            {input("salePrice",label(ar,"سعر البيع الجديد","New sale price"),{type:"number",required:true,min:0,step:"0.01"})}
          </>}
          {action==="purchase" && <>
            {select("productId",label(ar,"المنتج","Product"),data.products.map(p=>({value:String(p.id),title:p.name})))}
            {input("quantity",label(ar,"عدد القطع المشتراة","Quantity purchased"),{type:"number",required:true,min:1,step:"1"})}
            {input("unitCost",label(ar,"تكلفة القطعة عليك","Your cost per unit"),{type:"number",required:true,min:0,step:"0.01"})}
            {input("note",label(ar,"ملاحظة (اختياري)","Note (optional)"))}
            <p className="hint">{label(ar,"الشراء بيزيد المخزون وبيتسجل خارج نقدًا، من غير ما يخصم من الربح مرتين.","Buying increases stock and records a cash outflow without double-counting profit.")}</p>
          </>}
          {action==="sale" && <>
            {select("productId",label(ar,"المنتج","Product"),data.products.filter(p=>p.stock>0).map(p=>({value:String(p.id),title:`${p.name} — ${p.stock} ${ar?"متاح":"available"}`})))}
            {input("quantity",label(ar,"الكمية المباعة","Quantity sold"),{type:"number",required:true,min:1,step:"1"})}
            {input("unitPrice",label(ar,"سعر القطعة (اختياري؛ افتراضي سعر المنتج)","Unit price (optional; product default)"),{type:"number",min:0,step:"0.01"})}
          </>}
          <button className="btn btn-primary" disabled={busy}>{busy?<span className="spinner"/>:<Check />}{label(ar,"حفظ العملية","Save transaction")}</button>
        </div>
      </form>
    </div>}
  </>;
}
