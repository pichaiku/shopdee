// Browser-side session helpers (safe to import from server code: they no-op without `window`).

export interface StoredSession {
  type: "customer" | "admin";
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
}

export const CART_UPDATED_EVENT = "shopdee:cart-updated";

/** Reads the logged-in user from localStorage. Returns null when not logged in (or on the server). */
export function getSession(): { user: StoredSession; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("shopdee_token");
    const raw = localStorage.getItem("shopdee_user");
    if (!token || !raw) return null;
    const user = JSON.parse(raw) as StoredSession;
    return { user, token };
  } catch {
    return null;
  }
}

export function getCustomerSession() {
  const session = getSession();
  return session && session.user.type === "customer" ? session : null;
}

export function notifyCartUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export const formatBaht = (value: number | string) =>
  `฿${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
