import { test, expect, type Page } from "@playwright/test";
import { ADMIN, CUSTOMER, PNG_1PX, api, loginAs, mockJson, mockOmiseJs } from "./helpers";

/**
 * End-to-end flows through the real storefront UI.
 *
 * - Product pages are rendered on the server, so they use the real catalogue (read only).
 * - Calls the browser makes to the API are mocked per test, so no test writes to the database
 *   and no test calls Omise (Omise.js is replaced by a fake).
 * Run against Docker:   npx playwright test tests/e2e.spec.ts
 */

const CART_ORDER_ID = 501;

/** Stateful cart mock: GET returns the current items, PUT/DELETE change them. */
async function mockCart(page: Page, items: { productID: number; productName: string; price: number; quantity: number; stock?: number }[]) {
  const state = items.map((i) => ({ orderID: CART_ORDER_ID, imageFile: null, ...i }));
  const total = () => state.reduce((s, i) => s + i.price * i.quantity, 0);

  await mockJson(page, "cart/product", (req) => {
    if (req.method() === "PUT") {
      const { productID, quantity } = req.postDataJSON();
      const item = state.find((i) => i.productID === productID)!;
      if (item.stock !== undefined && quantity > item.stock) {
        return { status: 400, body: { status: false, message: `สินค้าในสต็อกไม่พอ (เหลือ ${item.stock} ชิ้น)` } };
      }
      item.quantity = quantity;
      return { status: true, message: "success" };
    }
    if (req.method() === "DELETE") {
      const { productID } = req.postDataJSON();
      state.splice(state.findIndex((i) => i.productID === productID), 1);
      return { status: true };
    }
    return state;
  });
  await mockJson(page, "cart/\\d+", () => [
    { orderID: CART_ORDER_ID, totalPrice: total(), itemCount: state.length, firstName: "Nadech", lastName: "K", address: "99 ถ.สุขุมวิท กรุงเทพฯ", mobilePhone: "0812345678" },
  ]);
  return state;
}

/** Order detail page mocks (orderinfo + orderdetail) for an order in the given status. */
async function mockOrder(page: Page, orderID: number, statusID: number, total = 450) {
  await mockJson(page, `orderinfo/\\d+/${orderID}`, [
    { orderID, statusID, statusName: ["", "รอชำระเงิน", "รอตรวจสอบการชำระ", "ชำระเงินแล้ว", "กำลังจัดส่ง", "จัดส่งสำเร็จ"][statusID], orderDate: "2026-11-10 10:00:00", totalPrice: total, firstName: "Nadech", lastName: "K", address: "99 ถ.สุขุมวิท กรุงเทพฯ", mobilePhone: "0812345678" },
  ]);
  await mockJson(page, `orderdetail/\\d+/${orderID}`, [
    { orderID, productID: 1, productName: "เสื้อแขนยาว", quantity: 1, price: 250 },
    { orderID, productID: 2, productName: "เสื้อแขนสั้น", quantity: 1, price: 200 },
  ]);
}

test.describe("Shopdee E2E Test Suite", () => {
  // ---------------------------------------------------------------- AUTH
  test("E2E-AUTH-001: Register a new account, then log in and land on the home page", async ({ page }) => {
    await mockJson(page, "register", { status: true, message: "Registration successful" });
    await mockJson(page, "login", { status: true, token: "mock-jwt-123", custID: 99, username: "new_customer", firstName: "New", lastName: "User" });
    await mockJson(page, "cart/\\d+", []);

    await page.goto("/register");
    await expect(page.locator("main h1")).toContainText("สร้างบัญชีผู้ใช้งานใหม่");
    await page.fill("#firstName", "New");
    await page.fill("#lastName", "User");
    await page.fill("#username", "new_customer");
    await page.fill("#password", "pass1234");
    await page.click("#submit-register");

    await expect(page.locator("#message-banner")).toContainText("สมัครสมาชิกสำเร็จ");
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 }); // auto-redirect after 2s

    await page.fill("#username", "new_customer");
    await page.fill("#password", "pass1234");
    await page.click("button[type=submit]");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("header")).toContainText("New");
    const user = await page.evaluate(() => JSON.parse(localStorage.getItem("shopdee_user") ?? "{}"));
    expect(user).toMatchObject({ type: "customer", id: 99, username: "new_customer" });
  });

  test("E2E-AUTH-002: Registration fails when the username already exists", async ({ page }) => {
    await mockJson(page, "register", { status: false, message: "Username already exists" }, 409);

    await page.goto("/register");
    await page.fill("#firstName", "Existing");
    await page.fill("#lastName", "User");
    await page.fill("#username", "existing_customer");
    await page.fill("#password", "pass1234");
    await page.click("#submit-register");

    await expect(page.locator("#message-banner")).toContainText("Username already exists");
    await expect(page).toHaveURL(/\/register$/);
  });

  // ---------------------------------------------------------------- PRODUCTS (real catalogue)
  const productLinks = (page: Page) => page.locator("section[aria-labelledby=all-products-title] a[href^='/products/']");

  test("E2E-PROD-001: Search by keyword and filter by price range", async ({ page }) => {
    await page.goto("/");
    await page.fill("#search-kw", "เสื้อ");
    await expect(productLinks(page).filter({ hasText: "เสื้อแขนยาว" }).first()).toBeVisible();
    await expect(productLinks(page).filter({ hasText: "กางเกงขายาว" })).toHaveCount(0);

    await page.fill("#price-min", "220");
    await page.fill("#price-max", "300");
    await page.click("#apply-filter");

    await expect(productLinks(page).filter({ hasText: "เสื้อแขนยาว" }).first()).toBeVisible(); // 250
    await expect(productLinks(page).filter({ hasText: "เสื้อแขนสั้น" })).toHaveCount(0); // 200
  });

  test("E2E-PROD-002: Search shows an empty state when nothing matches", async ({ page }) => {
    await page.goto("/");
    await page.fill("#search-kw", "xyznonexistent999");
    await expect(page.getByText("ไม่พบสินค้าที่ค้นหา")).toBeVisible();
    await expect(productLinks(page)).toHaveCount(0);

    await page.getByRole("button", { name: "ล้างตัวกรอง" }).first().click();
    await expect(productLinks(page).first()).toBeVisible();
  });

  // ---------------------------------------------------------------- CART
  test("E2E-CART-001: Add an item to the cart, then change the quantity and see the total update", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    let added: Record<string, unknown> | null = null;
    await mockJson(page, "makeorder", (req) => {
      added = req.postDataJSON();
      return { status: true, message: "success" };
    });
    await mockCart(page, [{ productID: 1, productName: "เสื้อแขนยาว", price: 250, quantity: 1 }]);

    await page.goto("/products/1");
    await page.click("#add-to-cart");
    await expect(page.getByText("ไปที่ตะกร้า")).toBeVisible();
    expect(added).toMatchObject({ custID: 1, productID: 1, quantity: 1 });

    await page.goto("/cart");
    await expect(page.locator("#subtotal")).toHaveText("฿250.00");
    await page.getByRole("button", { name: "เพิ่มจำนวน" }).click();
    await expect(page.locator("#subtotal")).toHaveText("฿500.00");
    await expect(page.locator("#cart-qty")).toHaveValue("2");
  });

  test("E2E-CART-002: Quantity above the available stock is rejected", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    await mockCart(page, [{ productID: 7, productName: "ร้องเท้าผ้าใบ", price: 1200, quantity: 1, stock: 3 }]);

    await page.goto("/cart");
    await page.fill("#cart-qty", "5");
    await page.locator("#cart-qty").blur();

    await expect(page.locator("#error-banner")).toContainText("สินค้าในสต็อกไม่พอ (เหลือ 3 ชิ้น)");
    await expect(page.locator("#subtotal")).toHaveText("฿1,200.00"); // unchanged
  });

  // ---------------------------------------------------------------- PAYMENT
  test("E2E-PAY-001: Confirm the cart and pay by credit card successfully", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    await mockCart(page, [{ productID: 1, productName: "เสื้อแขนยาว", price: 250, quantity: 1 }, { productID: 2, productName: "เสื้อแขนสั้น", price: 200, quantity: 1 }]);
    await mockJson(page, "confirmorder", { status: true });
    await mockOmiseJs(page, { ok: true, token: "tokn_test_e2e" });
    let paid = false;
    let charged: Record<string, unknown> = {};
    await mockJson(page, "confirmpayment", (req) => {
      charged = req.postDataJSON();
      paid = true;
      return { status: true, message: "ชำระเงินเรียบร้อยแล้ว" };
    });
    await page.route(api(`orderinfo/\\d+/${CART_ORDER_ID}`), (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify([{ orderID: CART_ORDER_ID, statusID: paid ? 3 : 1, totalPrice: 450, orderDate: "2026-11-10 10:00:00" }]) })
    );
    await mockJson(page, `orderdetail/\\d+/${CART_ORDER_ID}`, [{ productID: 1, productName: "เสื้อแขนยาว", quantity: 1, price: 250 }, { productID: 2, productName: "เสื้อแขนสั้น", quantity: 1, price: 200 }]);

    await page.goto("/cart");
    await page.click("#checkout-btn");
    await expect(page).toHaveURL(new RegExp(`/orders/${CART_ORDER_ID}`));

    await page.fill("#card-number", "4242424242424242");
    await page.fill("#card-name", "NADECH K");
    await page.fill("#card-expiry", "1230");
    await page.fill("#card-cvc", "123");
    await page.click("#pay-now");

    await expect(page.getByText("ชำระเงินด้วยบัตรเครดิตสำเร็จ")).toBeVisible();
    // the card number never reaches our API, only the Omise token does
    expect(charged).toEqual({ custID: 1, orderID: CART_ORDER_ID, paymentToken: "tokn_test_e2e" });
  });

  test("E2E-PAY-002: A declined card shows an error and the order stays unpaid", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    await mockOrder(page, 777, 1);
    await mockOmiseJs(page, { ok: true });
    await mockJson(page, "confirmpayment", { status: false, message: "Payment Failed: Insufficient funds" }, 402);

    await page.goto("/orders/777");
    await page.fill("#card-number", "4000000000000002");
    await page.fill("#card-name", "NADECH K");
    await page.fill("#card-expiry", "1230");
    await page.fill("#card-cvc", "123");
    await page.click("#pay-now");

    await expect(page.locator("#payment-error")).toContainText("Payment Failed: Insufficient funds");
    await expect(page.locator("#pay-now")).toBeEnabled();
  });

  test("E2E-PAY-003: Pay by bank transfer and upload a slip", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    await mockOrder(page, 778, 1);
    let uploaded = "";
    await mockJson(page, "payment", (req) => {
      uploaded = req.postData() ?? "";
      return { message: "success" };
    });

    await page.goto("/orders/778");
    await page.getByRole("button", { name: /โอน \/ แนบสลิป/ }).click();
    await page.setInputFiles("#slip-file", { name: "slip.png", mimeType: "image/png", buffer: PNG_1PX });
    await page.getByRole("button", { name: "ส่งสลิป" }).click();

    await expect(page.getByText("ส่งสลิปเรียบร้อยแล้ว")).toBeVisible();
    expect(uploaded).toContain('name="slipFile"');
    expect(uploaded).toContain('name="orderID"');
  });

  // ---------------------------------------------------------------- ORDERS
  test("E2E-ORD-001: View order history and the status timeline of an order", async ({ page }) => {
    await loginAs(page, CUSTOMER);
    await mockJson(page, "history/\\d+", [{ orderID: 999, orderDate: "2026-11-01 09:00:00", statusID: 4, statusName: "กำลังจัดส่ง", totalPrice: 450, totalQuantity: 2 }]);
    await mockOrder(page, 999, 4);

    await page.goto("/orders");
    await page.locator("#order-link").first().click();
    await expect(page).toHaveURL(/\/orders\/999/);

    const timeline = page.locator("#tracking-timeline");
    for (const step of ["รอชำระเงิน", "ตรวจสอบการชำระ", "ชำระแล้ว", "กำลังจัดส่ง", "ส่งสำเร็จ"]) {
      await expect(timeline).toContainText(step);
    }
    await expect(page.locator("main")).toContainText("เสื้อแขนยาว");
  });

  test("E2E-ORD-002: Admin changes an order's status from the orders tab", async ({ page }) => {
    await loginAs(page, ADMIN, "mock-token-admin");
    await mockJson(page, "admin/overview", {});
    await mockJson(page, "reports/.*", []);
    let statusUpdate: Record<string, unknown> | null = null;
    await mockJson(page, "admin/order/status", (req) => {
      if (req.method() === "POST") {
        statusUpdate = req.postDataJSON();
        return { status: true, message: "อัปเดตสถานะเรียบร้อยแล้ว" };
      }
      return [{ statusID: 3, statusName: "ชำระเงินแล้ว" }, { statusID: 4, statusName: "กำลังจัดส่ง" }];
    });
    await mockJson(page, "admin/history", [{ orderID: 200, custID: 1, firstName: "Nadech", lastName: "K", statusID: 3, statusName: "ชำระเงินแล้ว", totalPrice: 450 }]);
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      d.accept();
    });

    await page.goto("/admin");
    await page.click("aside button:has-text('รายการสั่งซื้อ')");
    await page.locator("table tbody tr select").first().selectOption("4");

    await expect.poll(() => statusUpdate).toMatchObject({ orderID: 200, statusID: 4 });
    await expect.poll(() => dialogs.join("|")).toContain("อัปเดตสถานะเรียบร้อยแล้ว");
  });

  // ---------------------------------------------------------------- RECOMMENDATIONS
  test("E2E-REC-001: Home page shows 10 best sellers for guests and ML picks for customers", async ({ page }) => {
    const popular = Array.from({ length: 10 }, (_, i) => ({ productID: i + 1, productName: `สินค้าขายดี ${i + 1}`, price: 100, quantity: 5, imageFile: null, source: "popular" }));
    await page.route(/\/api\/recommendations(\?|$)/, (route) => {
      const custID = new URL(route.request().url()).searchParams.get("custID");
      const items = custID
        ? [{ ...popular[4], productName: "สินค้าแนะนำ ML", source: "recommended" }, ...popular.filter((_, i) => i !== 4).slice(0, 9)]
        : popular;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items, recommendedCount: custID ? 1 : 0 }) });
    });
    const recLinks = page.locator("section[aria-labelledby=recommended-title] a[href^='/products/']");

    await page.goto("/");
    await expect(page.locator("#recommended-title")).toContainText("สินค้าขายดี 10 อันดับ");
    await expect(recLinks).toHaveCount(10);

    await loginAs(page, CUSTOMER);
    await mockJson(page, "cart/\\d+", []);
    await page.goto("/");
    await expect(page.locator("#recommended-title")).toContainText("สินค้าแนะนำสำหรับคุณ");
    await expect(recLinks).toHaveCount(10);
    await expect(recLinks.first()).toContainText("สินค้าแนะนำ ML");
  });

  // ---------------------------------------------------------------- RETURNS (not implemented)
  test.fixme("E2E-RET-001: Customer submits a return request (RMA) within 7 days", async () => {
    // The app has no return/RMA feature yet (no page, no API). Implement the feature, then this test.
  });

  test.fixme("E2E-RET-002: Return request is rejected after the 7-day window", async () => {
    // The app has no return/RMA feature yet (no page, no API). Implement the feature, then this test.
  });
});
