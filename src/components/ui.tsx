"use client";

import { useI18n } from "./I18nProvider";
import type { MemberState } from "@/lib/subs";

export function Avatar({
  name,
  gender = "male",
  size = "md",
}: {
  name: string;
  gender?: "male" | "female";
  size?: "sm" | "md" | "lg";
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <div className={`avatar ${size === "lg" ? "lg" : size === "sm" ? "sm" : ""} ${gender === "female" ? "f" : ""}`}>
      {initials}
    </div>
  );
}

export function StateBadge({ state }: { state: MemberState }) {
  const { t } = useI18n();
  const key = `st_${state}` as any;
  return <span className={`badge b-${state}`}>{t(key)}</span>;
}

export function DaysRing({
  left,
  total,
  state,
  size = 128,
}: {
  left: number;
  total: number;
  state: MemberState;
  size?: number;
}) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color =
    state === "active"
      ? "var(--ok)"
      : state === "expiring"
      ? "var(--warn)"
      : state === "expired" || state === "no_subscription"
      ? "var(--danger)"
      : "var(--info)";

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120">
        <circle className="track" cx="60" cy="60" r={r} />
        <circle
          className="val"
          cx="60"
          cy="60"
          r={r}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="ring-mid">
        <b className="num" style={{ color }}>
          {left}
        </b>
        <small>{t("days_left_label")}</small>
      </div>
    </div>
  );
}

export function PageHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="page-head row-b wrap">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="row gap-8 wrap">{right}</div>}
    </div>
  );
}

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="row gap-8" style={{ justifyContent: "center" }}>
        <span className="spinner" style={{ color: "var(--gold)" }} />
        {t("loading")}
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function Money({ value }: { value: number }) {
  const { t } = useI18n();
  return (
    <span className="num">
      {new Intl.NumberFormat("en-US").format(value)} <small className="t-muted">{t("egp")}</small>
    </span>
  );
}
