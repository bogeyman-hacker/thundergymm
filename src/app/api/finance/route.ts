import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { q, q1, exec, tx } from "@/lib/db";
import { handler, ok, fail, body, str, int, num } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(v: unknown): number {
  const n = num(v, -1);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : -1;
}
function owner(role: string) {
  if (role !== "owner") throw Object.assign(new Error("Owner access only"), { status: 403 });
}
function monthRange(month: string): [string, string] | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  if (y < 2020 || y > 2100) return null;
  return [`${month}-01`, `${new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)}`];
}
const cash = (x: number) => Math.round(x * 100) / 100;

/** Both cash flow and accrual profit, deliberately shown separately.
 * Buying inventory is a cash outflow NOW, but product cost is recognised as
 * COGS only when it is sold, avoiding double counting in net profit. */
export const GET = handler(async (req: NextRequest) => {
  owner((await requireSession()).role);
  const month = req.nextUrl.searchParams.get("month") ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" })
      .format(new Date()).replace(/\//g, "-");
  const range = monthRange(month);
  if (!range) return fail("Invalid month (YYYY-MM)", 422);
  const [from, to] = range;
  const [payments, expenses, purchases, sales, products, staff, debtors] = await Promise.all([
    q(`SELECT p.id, p.subscription_id, p.member_id, p.kind, p.amount, p.paid_at, p.note,
              m.full_name AS member_name
         FROM payments p LEFT JOIN members m ON m.id=p.member_id
        WHERE p.paid_at >= ? AND p.paid_at < ? ORDER BY p.paid_at DESC, p.id DESC LIMIT 1000`, [from, to]),
    q(`SELECT e.id, e.category, e.description, e.amount, e.paid_at, e.staff_id,
              s.full_name AS staff_name
         FROM expenses e LEFT JOIN staff s ON s.id=e.staff_id
        WHERE e.paid_at >= ? AND e.paid_at < ? ORDER BY e.paid_at DESC, e.id DESC LIMIT 1000`, [from, to]),
    q(`SELECT b.id, b.product_id, b.quantity, b.unit_cost, b.total_cost, b.purchased_at,
              p.name AS product_name
         FROM stock_purchases b JOIN products p ON p.id=b.product_id
        WHERE b.purchased_at >= ? AND b.purchased_at < ? ORDER BY b.purchased_at DESC LIMIT 1000`, [from, to]),
    q(`SELECT a.id, a.product_id, a.quantity, a.unit_price, a.total_amount, a.cost_amount,
              a.sold_at, p.name AS product_name
         FROM product_sales a JOIN products p ON p.id=a.product_id
        WHERE a.sold_at >= ? AND a.sold_at < ? ORDER BY a.sold_at DESC LIMIT 1000`, [from, to]),
    q(`SELECT id, name, sale_price, avg_cost, stock, active FROM products ORDER BY active DESC, name`),
    q(`SELECT id, full_name, monthly_salary FROM staff WHERE active=1 ORDER BY full_name`),
    q(`SELECT s.id AS subscription_id, s.member_id, m.full_name,
              s.price, s.paid, (s.price-s.paid) AS remaining, s.end_date
         FROM subscriptions s JOIN members m ON m.id=s.member_id
        WHERE s.price > s.paid AND s.status <> 'cancelled'
        ORDER BY s.end_date DESC LIMIT 200`),
  ]);
  // Ledger lists above are capped for UI performance; totals are NOT capped.
  const [pt, et, bt, st, dt] = await Promise.all([
    q1<{ fresh: string; renewed: string; later: string; all_in: string }>(
      `SELECT COALESCE(SUM(CASE WHEN kind='new' THEN amount ELSE 0 END),0) fresh,
              COALESCE(SUM(CASE WHEN kind='renewal' THEN amount ELSE 0 END),0) renewed,
              COALESCE(SUM(CASE WHEN kind='arrears' THEN amount ELSE 0 END),0) later,
              COALESCE(SUM(amount),0) all_in FROM payments WHERE paid_at >= ? AND paid_at < ?`, [from,to]),
    q1<{ total: string }>(`SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE paid_at >= ? AND paid_at < ?`,[from,to]),
    q1<{ total: string }>(`SELECT COALESCE(SUM(total_cost),0) total FROM stock_purchases WHERE purchased_at >= ? AND purchased_at < ?`,[from,to]),
    q1<{ revenue: string; cost: string }>(`SELECT COALESCE(SUM(total_amount),0) revenue,
       COALESCE(SUM(cost_amount),0) cost FROM product_sales WHERE sold_at >= ? AND sold_at < ?`,[from,to]),
    q1<{ total: string }>(`SELECT COALESCE(SUM(price-paid),0) total FROM subscriptions
       WHERE price>paid AND status <> 'cancelled'`),
  ]);
  const memberIncome = Number(pt?.all_in ?? 0);
  const salesIncome = Number(st?.revenue ?? 0);
  const operatingOut = Number(et?.total ?? 0);
  const inventoryOut = Number(bt?.total ?? 0);
  const soldCost = Number(st?.cost ?? 0);
  return ok({
    month, payments, expenses, purchases, sales, products, staff, debtors,
    summary: {
      newMembers: cash(Number(pt?.fresh ?? 0)),
      renewals: cash(Number(pt?.renewed ?? 0)),
      arrears: cash(Number(pt?.later ?? 0)),
      memberIncome: cash(memberIncome), salesIncome: cash(salesIncome),
      totalIn: cash(memberIncome + salesIncome), operatingOut: cash(operatingOut),
      inventoryOut: cash(inventoryOut), totalOut: cash(operatingOut + inventoryOut),
      cashNet: cash(memberIncome + salesIncome - operatingOut - inventoryOut),
      cogs: cash(soldCost),
      profit: cash(memberIncome + salesIncome - operatingOut - soldCost),
      outstanding: cash(Number(dt?.total ?? 0)),
    },
  });
});

/** Register an actual payment, operating expense, product purchase or sale. */
export const POST = handler(async (req: NextRequest) => {
  owner((await requireSession()).role);
  const b = await body<any>(req);
  const action = str(b.action, 30);

  if (action === "payment") {
    const subId = int(b.subscriptionId);
    const amount = money(b.amount);
    if (!subId || amount <= 0) return fail("Select a subscription and enter a positive amount", 422);
    return tx(async (conn) => {
      const [rows] = await conn.query(
        `SELECT member_id, price, paid FROM subscriptions WHERE id=? AND status <> 'cancelled' FOR UPDATE`,
        [subId]
      );
      const s = (rows as { member_id: number; price: string; paid: string }[])[0];
      if (!s) return fail("Subscription not found", 404);
      if (amount > Number(s.price) - Number(s.paid) + 0.001)
        return fail("Amount exceeds what is owed", 422);
      await conn.execute(`UPDATE subscriptions SET paid=paid+? WHERE id=?`, [amount, subId]);
      await conn.execute(
        `INSERT INTO payments (subscription_id, member_id, kind, amount, note)
         VALUES (?,?,'arrears',?,?)`, [subId, s.member_id, amount, str(b.note, 300)]
      );
      return ok({ received: amount }, 201);
    });
  }

  if (action === "expense") {
    const category = str(b.category, 30);
    if (!["salary", "supplies", "equipment", "utilities", "rent", "other"].includes(category))
      return fail("Invalid expense category", 422);
    const amount = money(b.amount);
    const description = str(b.description, 250);
    const staffId = b.staffId ? int(b.staffId) : null;
    if (amount <= 0 || !description) return fail("Description and positive amount are required", 422);
    if (staffId && category !== "salary") return fail("Staff is only for salary expenses", 422);
    if (staffId && !(await q1(`SELECT id FROM staff WHERE id=?`, [staffId]))) return fail("Staff not found", 404);
    const r = await exec(`INSERT INTO expenses (category,description,amount,staff_id) VALUES (?,?,?,?)`,
      [category, description, amount, staffId]);
    return ok({ id: r.insertId }, 201);
  }

  if (action === "product") {
    const name = str(b.name, 160);
    const price = money(b.salePrice);
    if (!name || price < 0) return fail("Name and valid sale price are required", 422);
    const r = await exec(`INSERT INTO products (name,sale_price) VALUES (?,?)`, [name, price]);
    return ok({ id: r.insertId }, 201);
  }

  if (action === "price") {
    const id = int(b.productId);
    const price = money(b.salePrice);
    if (!id || price < 0) return fail("Invalid product or price", 422);
    const r = await exec(`UPDATE products SET sale_price=? WHERE id=?`, [price, id]);
    if (!r.affectedRows) return fail("Product not found", 404);
    return ok();
  }

  if (action === "purchase") {
    const id = int(b.productId), quantity = int(b.quantity);
    const unitCost = money(b.unitCost);
    if (!id || quantity < 1 || quantity > 100000 || unitCost < 0)
      return fail("Valid product, quantity and unit cost required", 422);
    return tx(async (conn) => {
      const [rows] = await conn.query(`SELECT stock, avg_cost FROM products WHERE id=? FOR UPDATE`, [id]);
      const p = (rows as { stock: number; avg_cost: string }[])[0];
      if (!p) return fail("Product not found", 404);
      const stock = Number(p.stock), total = cash(quantity * unitCost);
      const avg = (stock * Number(p.avg_cost) + total) / (stock + quantity);
      await conn.execute(`UPDATE products SET stock=stock+?, avg_cost=? WHERE id=?`, [quantity, avg, id]);
      await conn.execute(`INSERT INTO stock_purchases (product_id,quantity,unit_cost,total_cost,note)
                          VALUES (?,?,?,?,?)`, [id, quantity, unitCost, total, str(b.note, 250)]);
      return ok({ total, stock: stock + quantity }, 201);
    });
  }

  if (action === "sale") {
    const id = int(b.productId), quantity = int(b.quantity);
    if (!id || quantity < 1 || quantity > 100000) return fail("Invalid product or quantity", 422);
    return tx(async (conn) => {
      const [rows] = await conn.query(`SELECT stock, avg_cost, sale_price, active FROM products WHERE id=? FOR UPDATE`, [id]);
      const p = (rows as { stock: number; avg_cost: string; sale_price: string; active: number }[])[0];
      if (!p) return fail("Product not found", 404);
      if (!p.active || p.stock < quantity) return fail("Not enough stock", 422);
      const unitPrice = b.unitPrice === undefined ? Number(p.sale_price) : money(b.unitPrice);
      if (unitPrice < 0) return fail("Invalid price", 422);
      const total = cash(quantity * unitPrice), cost = cash(quantity * Number(p.avg_cost));
      await conn.execute(`UPDATE products SET stock=stock-? WHERE id=?`, [quantity, id]);
      await conn.execute(`INSERT INTO product_sales
        (product_id,quantity,unit_price,total_amount,cost_amount) VALUES (?,?,?,?,?)`,
        [id, quantity, unitPrice, total, cost]);
      return ok({ total, cost, stock: p.stock - quantity }, 201);
    });
  }
  return fail("Unknown finance action", 422);
});
