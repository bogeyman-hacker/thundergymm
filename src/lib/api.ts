export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      cache: "no-store",
      ...init,
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Bad response" }));
    if (res.status === 401 && typeof window !== "undefined") {
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return data as ApiResult<T>;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

export const api = {
  get: <T = any>(url: string) => request<T>(url),
  post: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T = any>(url: string) => request<T>(url, { method: "DELETE" }),
};
