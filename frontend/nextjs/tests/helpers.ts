import type { Page, Route, Request } from "@playwright/test";

/**
 * Shared helpers for the Playwright suites.
 *
 * Browser-side API calls go to NEXT_PUBLIC_API_BASE_URL:
 *   Docker (nginx)  -> http://localhost/api/node/<path>
 *   local dev       -> http://localhost:4000/api/<path>
 * `api("cart/product")` matches both, and never matches Next.js' own /api/recommendations route.
 *
 * Pages rendered on the server (home, /products, /products/[id]) read real data from the
 * backend, so tests on those pages only read data and never change it.
 */
export const api = (path: string) => new RegExp(`/api(?:/node)?/${path.replace(/^\//, "")}(?:[/?#]|$)`);

/** A JSON body, or a function of the request returning a body or `{ status, body }`. */
type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;
type JsonHandler = JsonBody | ((req: Request) => unknown);

/** Respond to matching API calls with JSON. `handler` can be a body or a function of the request. */
export async function mockJson(page: Page, path: string, handler: JsonHandler, status = 200) {
  await page.route(api(path), async (route: Route) => {
    let code = status;
    let body: unknown = handler;
    if (typeof handler === "function") {
      const out = (handler as (req: Request) => unknown)(route.request());
      if (out && typeof out === "object" && "body" in (out as Record<string, unknown>)) {
        code = (out as { status?: number }).status ?? status;
        body = (out as { body: unknown }).body;
      } else {
        body = out;
      }
    }
    await route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(body) });
  });
}

export const CUSTOMER = { type: "customer", id: 1, username: "nadech", firstName: "Nadech", lastName: "K" };
export const ADMIN = { type: "admin", id: 1, username: "admin", firstName: "Sompong", lastName: "J", positionID: 1 };

/** Log in without the UI: the app keeps the session in localStorage. */
export async function loginAs(page: Page, user: typeof CUSTOMER | typeof ADMIN, token = "mock-token") {
  await page.addInitScript(
    ([u, t]) => {
      localStorage.setItem("shopdee_token", t as string);
      localStorage.setItem("shopdee_user", JSON.stringify(u));
    },
    [user, token] as const
  );
}

/**
 * Replace Omise.js (https://cdn.omise.co/omise.js) with a fake that returns a token
 * (or an error), so card-payment tests never call Omise.
 */
export async function mockOmiseJs(page: Page, outcome: { ok: true; token?: string } | { ok: false; message: string }) {
  const script = outcome.ok
    ? `window.Omise = { setPublicKey(){}, createToken(_t, _c, cb){ setTimeout(() => cb(200, { object: "token", id: ${JSON.stringify(outcome.token ?? "tokn_test_e2e")} }), 50); } };`
    : `window.Omise = { setPublicKey(){}, createToken(_t, _c, cb){ setTimeout(() => cb(400, { object: "error", message: ${JSON.stringify(outcome.message)} }), 50); } };`;
  await page.route(/cdn\.omise\.co\/omise\.js/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: script }));
}

/** Minimal 1x1 PNG for file-upload tests. */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);
