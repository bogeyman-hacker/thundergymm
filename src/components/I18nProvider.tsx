"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { dict, type Lang, type Key } from "@/lib/i18n";

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (k: Key) => string;
  setLang: (l: Lang) => void;
  toggle: () => void;
  fmtDate: (d: string | Date | null | undefined) => string;
  fmtDateTime: (d: string | Date | null | undefined) => string;
  fmtNum: (n: number) => string;
};

const I18nCtx = createContext<Ctx | null>(null);
const KEY = "tg_lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Lang | null) ?? "ar";
    setLangState(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (ready) localStorage.setItem(KEY, lang);
  }, [lang, ready]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((p) => (p === "ar" ? "en" : "ar")), []);

  const t = useCallback((k: Key) => (dict[lang] as Record<string, string>)[k] ?? k, [lang]);

  // force Latin digits in Arabic so codes/dates stay readable next to serials
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB";

  const fmtDate = useCallback(
    (d: string | Date | null | undefined) => {
      if (!d) return "—";
      const date = typeof d === "string" ? new Date(d.length <= 10 ? d + "T00:00:00Z" : d) : d;
      if (isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
    },
    [locale]
  );

  const fmtDateTime = useCallback(
    (d: string | Date | null | undefined) => {
      if (!d) return "—";
      const date = typeof d === "string" ? new Date(d) : d;
      if (isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: lang === "en",
      }).format(date);
    },
    [locale, lang]
  );

  const fmtNum = useCallback(
    (n: number) => new Intl.NumberFormat(lang === "ar" ? "en-US" : "en-US").format(n),
    [lang]
  );

  return (
    <I18nCtx.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", t, setLang, toggle, fmtDate, fmtDateTime, fmtNum }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n must be used inside <I18nProvider>");
  return c;
}

/** Small AR/EN switch button. */
export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  if (compact) {
    return (
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        aria-label="Change language"
        title={lang === "ar" ? "English" : "العربية"}
      >
        {lang === "ar" ? "EN" : "ع"}
      </button>
    );
  }
  return (
    <div className="seg" role="group" aria-label="Language">
      <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>
        العربية
      </button>
      <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
        English
      </button>
    </div>
  );
}
