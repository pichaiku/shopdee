import { test, expect, type Page, type Request } from "@playwright/test";
import { ADMIN, CUSTOMER, PNG_1PX, api, loginAs, mockJson } from "./helpers";

/**
 * Functional tests for every customer and admin feature of the Next.js app.
 * The browser's API calls are mocked (see helpers.ts), so the suite never changes the database.
 * Test IDs match tests/template + tests/test-results spreadsheets.
 */

/** Collect browser dialogs (the admin pages report results with alert()). Accepts every dialog. */
function trackDialogs(page: Page) {
  const messages: string[] = [];
  page.on("dialog", (d) => {
    messages.push(d.message());
    d.accept();
  });
  return messages;
}

/** Record API requests that match `path`, e.g. to assert a POST/PUT/DELETE was (not) sent. */
function trackRequests(page: Page, path: string) {
  const re = api(path);
  const sent: Request[] = [];
  page.on("request", (r) => {
    if (re.test(r.url())) sent.push(r);
  });
  return (method: string) => sent.filter((r) => r.method() === method);
}

test.describe("Shopdee Functional Test Suite", () => {
  // =========================================================================
  // CUSTOMER
  // =========================================================================
  test.describe("1. Customer Authentication", () => {
    test("FUNC-CUST-AUTH-001: Register new customer account - Success", async ({ page }) => {
      await mockJson(page, "register", { status: true, message: "สมัครสมาชิกสำเร็จ" });
      await page.goto("/register");
      await page.fill("#firstName", "Nadech");
      await page.fill("#lastName", "Kugimiya");
      await page.fill("#username", "nadech_new");
      await page.fill("#password", "1234");
      await page.click("#submit-register");
      await expect(page.locator("#message-banner")).toContainText("สมัครสมาชิกสำเร็จ");
    });

    test("FUNC-CUST-AUTH-002: Register new customer account - Duplicate Username", async ({ page }) => {
      await mockJson(page, "register", { status: false, message: "Username already exists" }, 409);
      await page.goto("/register");
      await page.fill("#firstName", "Nadech");
      await page.fill("#lastName", "Kugimiya");
      await page.fill("#username", "nadech");
      await page.fill("#password", "1234");
      await page.click("#submit-register");
      await expect(page.locator("#message-banner")).toContainText("Username already exists");
    });

    test("FUNC-CUST-AUTH-003: Login as Customer - Success", async ({ page }) => {
      await mockJson(page, "login", { status: true, token: "mock-token", custID: 1, username: "nadech", firstName: "Nadech", lastName: "K" });
      await mockJson(page, "cart/\\d+", []);
      await page.goto("/login");
      await page.getByRole("button", { name: "ลูกค้า", exact: true }).click();
      await page.fill("#username", "nadech");
      await page.fill("#password", "1234");
      await page.click("button[type='submit']");
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("link", { name: "ตะกร้าสินค้า" })).toBeVisible();
      await expect(page.locator("header")).toContainText("Nadech");
    });

    test("FUNC-CUST-AUTH-004: Login as Customer - Invalid Password", async ({ page }) => {
      await mockJson(page, "login", { status: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
      await page.goto("/login");
      await page.fill("#username", "nadech");
      await page.fill("#password", "wrong");
      await page.click("button[type='submit']");
      await expect(page.locator("form p[role=alert]")).toContainText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      await expect(page).toHaveURL(/\/login$/);
    });

    test("FUNC-CUST-AUTH-005: Logout as Customer", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", []);
      await page.goto("/");
      await page.locator("header").getByTitle("ออกจากระบบ").click();
      await expect(page).toHaveURL(/\/login$/);
      expect(await page.evaluate(() => localStorage.getItem("shopdee_token"))).toBeNull();
    });
  });

  test.describe("2. Customer Products Catalog", () => {
    const productLinks = (page: Page) => page.locator("section[aria-labelledby=all-products-title] a[href^='/products/']");

    test("FUNC-CUST-PROD-001: Search and browse product catalog - Success", async ({ page }) => {
      await page.goto("/products");
      await expect(productLinks(page).first()).toBeVisible();
      await page.fill("#search-kw", "เสื้อ");
      await expect(productLinks(page).filter({ hasText: "เสื้อแขนยาว" }).first()).toBeVisible();
      await expect(productLinks(page).filter({ hasText: "หมวก" })).toHaveCount(0);
      await productLinks(page).filter({ hasText: "เสื้อแขนยาว" }).first().click();
      await expect(page).toHaveURL(/\/products\/1$/);
      await expect(page.locator("main h1")).toContainText("เสื้อแขนยาว");
    });

    test("FUNC-CUST-PROD-002: Search returns empty state", async ({ page }) => {
      await page.goto("/products");
      await page.fill("#search-kw", "ไม่มีสินค้านี้แน่นอน");
      await expect(page.getByText("ไม่พบสินค้าที่ค้นหา")).toBeVisible();
      await expect(productLinks(page)).toHaveCount(0);
    });
  });

  test.describe("3. Customer Cart Operations", () => {
    const cartSummary = [{ orderID: 100, totalPrice: 250, itemCount: 1, firstName: "Nadech", lastName: "K", address: "Bangkok" }];
    const cartItem = { orderID: 100, productID: 1, productName: "เสื้อแขนยาว", quantity: 1, price: 250, imageFile: null };

    test("FUNC-CUST-CART-001: Add to cart and increment quantity - Success", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", cartSummary);
      let quantity = 1;
      await mockJson(page, "cart/product", (req) => {
        if (req.method() === "PUT") quantity = req.postDataJSON().quantity;
        return req.method() === "GET" ? [{ ...cartItem, quantity }] : { status: true };
      });
      await page.goto("/cart");
      await expect(page.locator("main h1")).toContainText("ตะกร้าของฉัน");
      await expect(page.locator("main")).toContainText("เสื้อแขนยาว");
      await page.getByRole("button", { name: "เพิ่มจำนวน" }).click();
      await expect(page.locator("#cart-qty")).toHaveValue("2");
      await expect(page.locator("#subtotal")).toHaveText("฿500.00");
    });

    test("FUNC-CUST-CART-002: Block quantity exceeding stock", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", cartSummary);
      await mockJson(page, "cart/product", (req) =>
        req.method() === "PUT" ? { status: 400, body: { status: false, message: "สินค้าสต็อกไม่พอ" } } : [cartItem]
      );
      await page.goto("/cart");
      await page.fill("#cart-qty", "50");
      await page.locator("#cart-qty").blur();
      await expect(page.locator("#error-banner")).toContainText("สินค้าสต็อกไม่พอ");
    });

    test("FUNC-CUST-CART-003: Delete product from shopping cart", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      let items = [cartItem];
      await mockJson(page, "cart/\\d+", () => (items.length ? cartSummary : []));
      await mockJson(page, "cart/product", (req) => {
        if (req.method() === "DELETE") {
          items = [];
          return { status: true };
        }
        return items;
      });
      await page.goto("/cart");
      await page.getByRole("button", { name: "ลบสินค้า" }).click();
      await expect(page.getByText("ตะกร้าของคุณยังว่างอยู่")).toBeVisible();
    });
  });

  test.describe("4. Customer Orders & Slip", () => {
    test("FUNC-CUST-ORDER-001: Place order and go to the payment page", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", [{ orderID: 200, totalPrice: 240, itemCount: 1, firstName: "Nadech", lastName: "K" }]);
      await mockJson(page, "cart/product", [{ orderID: 200, productID: 9, productName: "ถุงเท้ายาว", quantity: 2, price: 120, imageFile: null }]);
      let confirmed: Record<string, unknown> | null = null;
      await mockJson(page, "confirmorder", (req) => {
        confirmed = req.postDataJSON();
        return { status: true };
      });
      await mockJson(page, "orderinfo/\\d+/200", [{ orderID: 200, statusID: 1, statusName: "รอชำระเงิน", totalPrice: 240, orderDate: "2026-11-10 10:00:00" }]);
      await mockJson(page, "orderdetail/\\d+/200", [{ productID: 9, productName: "ถุงเท้ายาว", quantity: 2, price: 120 }]);

      await page.goto("/cart");
      await page.click("#checkout-btn");
      await expect(page).toHaveURL(/\/orders\/200\?pay=1/);
      expect(confirmed).toMatchObject({ custID: 1, orderID: 200 });
      await expect(page.locator("#payment")).toBeVisible();
    });

    test("FUNC-CUST-ORDER-002: Display customer order history", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "history/\\d+", [
        { orderID: 200, orderDate: "2026-08-28 10:00:00", statusID: 2, statusName: "รอตรวจสอบการชำระ", totalPrice: 240, totalQuantity: 2 },
        { orderID: 201, orderDate: "2026-09-01 10:00:00", statusID: 5, statusName: "จัดส่งสำเร็จ", totalPrice: 500, totalQuantity: 1 },
      ]);
      await page.goto("/orders");
      await expect(page.locator("main h1")).toContainText("คำสั่งซื้อของฉัน");
      await expect(page.locator("#order-link")).toHaveCount(2);
      await expect(page.locator("main")).toContainText("#200");
    });

    test("FUNC-CUST-ORDER-002b: Order history is empty", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "history/\\d+", []);
      await page.goto("/orders");
      await expect(page.getByText("ยังไม่มีคำสั่งซื้อ")).toBeVisible();
      await expect(page.locator("#order-link")).toHaveCount(0);
    });

    test("FUNC-CUST-ORDER-003: Upload payment slip file - Success", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "orderinfo/\\d+/200", [{ orderID: 200, statusID: 1, statusName: "รอชำระเงิน", totalPrice: 240, orderDate: "2026-11-10 10:00:00" }]);
      await mockJson(page, "orderdetail/\\d+/200", [{ productID: 9, productName: "ถุงเท้ายาว", quantity: 2, price: 120 }]);
      await mockJson(page, "payment", { message: "success" });
      await page.goto("/orders/200");
      await page.getByRole("button", { name: /โอน \/ แนบสลิป/ }).click();
      await page.setInputFiles("#slip-file", { name: "slip.png", mimeType: "image/png", buffer: PNG_1PX });
      await page.getByRole("button", { name: "ส่งสลิป" }).click();
      await expect(page.getByText("ส่งสลิปเรียบร้อยแล้ว")).toBeVisible();
    });
  });

  test.describe("5. Customer Profile Management", () => {
    const profile = { custID: 1, username: "nadech", firstName: "Nadech", lastName: "K", email: "nadech@email.com", mobilePhone: "0812345678", address: "Bangkok", imageFile: null };

    test("FUNC-CUST-PROF-001: Update profile contact info details - Success", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", []);
      await mockJson(page, "profile/\\d+", profile);
      let saved: Record<string, unknown> | null = null;
      await mockJson(page, "customer/\\d+", (req) => {
        if (req.method() === "PUT") saved = req.postDataJSON();
        return { status: true, message: "success" };
      });
      await page.goto("/profile");
      await page.getByRole("button", { name: "แก้ไขข้อมูล" }).click();
      await page.locator("input[value='Nadech']").fill("Nadech Update");
      await page.getByRole("button", { name: "บันทึก", exact: true }).click();
      await expect(page.locator("main")).toContainText("แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว");
      expect(saved).toMatchObject({ firstName: "Nadech Update" });
    });

    test("FUNC-CUST-PROF-002: Upload customer profile image - Success", async ({ page }) => {
      await loginAs(page, CUSTOMER);
      await mockJson(page, "cart/\\d+", []);
      await mockJson(page, "profile/\\d+", profile);
      await mockJson(page, "customer/image/upload/\\d+", { status: true, message: "success" });
      await page.goto("/profile");
      await page.setInputFiles("input[type='file']", { name: "avatar.png", mimeType: "image/png", buffer: PNG_1PX });
      await expect(page.locator("main")).toContainText("อัปโหลดไฟล์รูปภาพเรียบร้อยแล้ว");
    });
  });

  // =========================================================================
  // ADMIN / STAFF
  // =========================================================================
  /** Dashboard data every admin page loads on start. */
  async function mockAdminShell(page: Page) {
    await loginAs(page, ADMIN, "mock-token-admin");
    await mockJson(page, "admin/overview", { customerCount: 85, employeeCount: 4, typeCount: 5, productCount: 30 });
    await mockJson(page, "reports/.*", []);
    await mockJson(page, "admin/history", []);
    await mockJson(page, "admin/order/status", [{ statusID: 1, statusName: "รอชำระเงิน" }, { statusID: 2, statusName: "รอตรวจสอบการชำระ" }, { statusID: 3, statusName: "ชำระเงินแล้ว" }, { statusID: 4, statusName: "กำลังจัดส่ง" }]);
  }
  const openMenu = (page: Page, label: string) => page.locator("aside").getByRole("button", { name: label, exact: true }).click();

  test.describe("6. Admin Authentication", () => {
    test("FUNC-ADMN-AUTH-001: Login as Admin/Staff - Success", async ({ page }) => {
      await mockAdminShell(page);
      await page.addInitScript(() => localStorage.clear()); // start logged out
      await mockJson(page, "admin/login", { status: true, token: "mock-token-admin", empID: 1, username: "admin", firstName: "Sompong", lastName: "Jaidee", positionID: 1 });
      await page.goto("/login");
      await page.getByRole("button", { name: "พนักงาน", exact: true }).click();
      await page.fill("#username", "admin");
      await page.fill("#password", "1234");
      await page.click("button[type='submit']");
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.locator("aside")).toContainText("แดชบอร์ด");
    });

    test("FUNC-ADMN-AUTH-002: Login as Admin/Staff - Invalid Password", async ({ page }) => {
      await mockJson(page, "admin/login", { status: false, message: "รหัสผ่านไม่ถูกต้อง" }, 401);
      await page.goto("/login");
      await page.getByRole("button", { name: "พนักงาน", exact: true }).click();
      await page.fill("#username", "admin");
      await page.fill("#password", "wrong");
      await page.click("button[type='submit']");
      await expect(page.locator("form p[role=alert]")).toContainText("รหัสผ่านไม่ถูกต้อง");
    });

    test("FUNC-ADMN-AUTH-003: Logout as Admin/Staff", async ({ page }) => {
      await mockAdminShell(page);
      await page.goto("/admin");
      await page.locator("header").getByRole("button", { name: /ออกจากระบบ/ }).click();
      await expect(page).toHaveURL(/\/login$/);
    });
  });

  test.describe("7. Admin Dashboard & Orders", () => {
    const order = { orderID: 200, custID: 1, firstName: "Nadech", lastName: "K", statusID: 2, statusName: "รอตรวจสอบการชำระ", totalPrice: 240, orderDate: "2026-11-10 10:00:00" };

    async function openOrderDetail(page: Page) {
      await mockJson(page, "admin/history", [order]);
      await mockJson(page, "orderinfo/200", [{ ...order, address: "Bangkok", mobilePhone: "0812345678", channelID: 1, slipFile: "slip_200.jpg", paymentDate: "2026-11-10 11:00:00", slipCount: 2, orderDetails: [{ productID: 9, productName: "ถุงเท้ายาว", quantity: 2, price: 120 }] }]);
      await page.goto("/admin");
      await openMenu(page, "รายการสั่งซื้อ");
      await page.getByRole("button", { name: /รายละเอียด/ }).first().click();
      await expect(page.locator("h3")).toContainText("รายละเอียดคำสั่งซื้อ #200");
    }

    test("FUNC-ADMN-DASH-001: Show dashboard reports and overview stats", async ({ page }) => {
      await mockAdminShell(page);
      await page.goto("/admin");
      await expect(page.locator("main")).toContainText("ยอดขายรวมปีปัจจุบัน");
      await expect(page.locator("main")).toContainText("ลูกค้าทั้งหมด");
      await expect(page.locator("main")).toContainText("85");
    });

    test("FUNC-ADMN-ORDER-001: Display orders list", async ({ page }) => {
      await mockAdminShell(page);
      await mockJson(page, "admin/history", [order]);
      await page.goto("/admin");
      await openMenu(page, "รายการสั่งซื้อ");
      await expect(page.locator("main table")).toContainText("Nadech K");
      await expect(page.locator("main table")).toContainText("#200");
    });

    test("FUNC-ADMN-ORDER-002: Show order detail modal with the latest slip", async ({ page }) => {
      await mockAdminShell(page);
      await openOrderDetail(page);
      const slip = page.getByRole("img", { name: "Transfer Slip" });
      await expect(slip).toHaveAttribute("src", /\/payment\/image\/slip_200\.jpg$/);
      await expect(page.getByText("สลิปล่าสุด")).toContainText("2 ครั้ง");
    });

    for (const [id, button, statusID] of [
      ["FUNC-ADMN-ORDER-003: Approve payment slip status", /อนุมัติยอดเงิน/, 3],
      ["FUNC-ADMN-ORDER-004: Reject payment slip status", /ปฏิเสธ/, 1],
    ] as const) {
      test(id, async ({ page }) => {
        await mockAdminShell(page);
        const sent = trackRequests(page, "admin/order/status");
        trackDialogs(page);
        await openOrderDetail(page);
        await page.getByRole("button", { name: button }).click();
        await expect(page.locator("h3", { hasText: "รายละเอียดคำสั่งซื้อ" })).toHaveCount(0);
        expect(sent("POST")).toHaveLength(1);
        expect(sent("POST")[0].postDataJSON()).toMatchObject({ orderID: 200, statusID });
      });
    }

    test("FUNC-ADMN-ORDER-005: Update order status from the orders table", async ({ page }) => {
      await mockAdminShell(page);
      await mockJson(page, "admin/history", [{ ...order, statusID: 3, statusName: "ชำระเงินแล้ว" }]);
      const sent = trackRequests(page, "admin/order/status");
      const dialogs = trackDialogs(page);
      await page.route(api("admin/order/status"), (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: true, message: "อัปเดตสถานะเรียบร้อยแล้ว" }) })
          : route.fallback()
      );
      await page.goto("/admin");
      await openMenu(page, "รายการสั่งซื้อ");
      await page.locator("table tbody tr select").first().selectOption("4");
      await expect.poll(() => sent("POST").length).toBe(1);
      expect(sent("POST")[0].postDataJSON()).toMatchObject({ orderID: 200, statusID: 4 });
      await expect.poll(() => dialogs.join("|")).toContain("อัปเดตสถานะเรียบร้อยแล้ว");
    });
  });

  // =========================================================================
  // ADMIN CRUD TABS (8 tabs x 8 cases)
  // =========================================================================
  type CrudTab = {
    menu: string;
    code: string;
    api: string; // API resource, e.g. "customer"
    key: string; // primary key field
    row: Record<string, unknown>;
    addButton: RegExp;
    /** select filters that must be set before the list loads (districts / subdistricts) */
    filters?: (page: Page) => Promise<unknown>;
    /** fill the create form with valid data */
    fill: (page: Page) => Promise<unknown>;
    /** a required text field of the form, cleared in the "empty fields" test */
    requiredField: string;
  };

  const byPlaceholder = (page: Page, text: string) => page.locator(`form [placeholder="${text}"]`);
  const provinces = [{ provinceID: "10", provinceName: "กรุงเทพมหานคร" }];
  const districts = [{ districtID: "1001", districtName: "เขตพระนคร", provinceID: "10" }];

  const tabs: CrudTab[] = [
    {
      menu: "ข้อมูลลูกค้า", code: "CUST", api: "customer", key: "custID",
      row: { custID: 1, username: "nadech", firstName: "Nadech", lastName: "K", mobilePhone: "0812345678", email: "n@email.com" },
      addButton: /เพิ่มรายชื่อลูกค้า/,
      fill: async (page) => {
        await byPlaceholder(page, "Username ของลูกค้า").fill("test_user");
        await byPlaceholder(page, "รหัสผ่าน").fill("1234");
        await byPlaceholder(page, "ชื่อจริง").fill("Test");
        await byPlaceholder(page, "นามสกุล").fill("User");
      },
      requiredField: "ชื่อจริง",
    },
    {
      menu: "ข้อมูลพนักงาน", code: "EMP", api: "employee", key: "empID",
      row: { empID: 1, username: "admin", firstName: "Sompong", lastName: "J", positionID: 1, positionName: "Manager" },
      addButton: /เพิ่มพนักงานใหม่/,
      fill: async (page) => {
        await byPlaceholder(page, "Username พนักงาน").fill("test_emp");
        await byPlaceholder(page, "รหัสผ่านเข้าใช้งาน").fill("1234");
        await byPlaceholder(page, "ชื่อจริง").fill("Test");
        await byPlaceholder(page, "นามสกุล").fill("Emp");
      },
      requiredField: "ชื่อจริง",
    },
    {
      menu: "ข้อมูลสินค้า", code: "PROD", api: "product", key: "productID",
      row: { productID: 1, productName: "Laptop Pro", productDetail: "16GB", price: 29900, cost: 25000, quantity: 10, typeID: 1, typeName: "Gadgets", imageFile: "laptop.jpg" },
      addButton: /เพิ่มสินค้าใหม่/,
      fill: async (page) => {
        await byPlaceholder(page, "ชื่อสินค้า").fill("Test Product");
        const numbers = page.locator("form input[type='number']");
        for (let i = 0; i < (await numbers.count()); i++) await numbers.nth(i).fill(String([590, 400, 20][i] ?? 1));
        const type = page.locator("form select").first();
        if (await type.count()) await type.selectOption({ index: 1 }).catch(() => undefined);
        await page.locator("form input[type='file']").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG_1PX });
      },
      requiredField: "ชื่อสินค้า",
    },
    {
      menu: "ประเภทสินค้า", code: "TYPE", api: "producttype", key: "typeID",
      row: { typeID: 1, typeName: "Gadgets" },
      addButton: /เพิ่มประเภท/,
      fill: (page) => byPlaceholder(page, "เช่น เสื้อผ้า, อุปกรณ์กีฬา").fill("Test Type"),
      requiredField: "เช่น เสื้อผ้า, อุปกรณ์กีฬา",
    },
    {
      menu: "ตำแหน่ง", code: "POS", api: "position", key: "positionID",
      row: { positionID: 1, positionName: "Manager" },
      addButton: /เพิ่มตำแหน่ง/,
      fill: (page) => byPlaceholder(page, "เช่น ผู้ช่วยแอดมิน, ฝ่ายจัดส่ง").fill("Test Position"),
      requiredField: "เช่น ผู้ช่วยแอดมิน, ฝ่ายจัดส่ง",
    },
    {
      menu: "จังหวัด", code: "PROV", api: "province", key: "provinceID",
      row: { provinceID: "10", provinceName: "กรุงเทพมหานคร" },
      addButton: /เพิ่มจังหวัด/,
      fill: async (page) => {
        await byPlaceholder(page, "เช่น 81").fill("81");
        await byPlaceholder(page, "เช่น กระบี่").fill("กระบี่");
      },
      requiredField: "เช่น กระบี่",
    },
    {
      menu: "อำเภอ", code: "DIST", api: "district", key: "districtID",
      row: { districtID: "1001", districtName: "เขตพระนคร", provinceID: "10", provinceName: "กรุงเทพมหานคร" },
      addButton: /เพิ่มอำเภอ/,
      filters: (page) => page.locator("#province-filter-tab").selectOption("10"),
      fill: async (page) => {
        const select = page.locator("form select").first();
        if (await select.isEnabled()) await select.selectOption("10");
        await byPlaceholder(page, "เช่น 1001").fill("1099");
        await byPlaceholder(page, "เช่น เขตพระนคร, อำเภอบางพลี").fill("เขตทดสอบ");
      },
      requiredField: "เช่น เขตพระนคร, อำเภอบางพลี",
    },
    {
      menu: "ตำบล", code: "SUBD", api: "subdistrict", key: "subdistrictID",
      row: { subdistrictID: "100101", subdistrictName: "พระบรมมหาราชวัง", districtID: "1001", districtName: "เขตพระนคร", postcode: "10200" },
      addButton: /เพิ่มตำบล/,
      filters: async (page) => {
        await page.locator("#province-select-sub-tab").selectOption("10");
        await page.locator("#district-select-sub-tab").selectOption("1001");
      },
      fill: async (page) => {
        const selects = page.locator("form select");
        if (await selects.nth(0).isEnabled()) await selects.nth(0).selectOption("10");
        if (await selects.nth(1).isEnabled()) await selects.nth(1).selectOption("1001");
        await byPlaceholder(page, "เช่น 100101").fill("100199");
        await byPlaceholder(page, "เช่น พระบรมมหาราชวัง").fill("แขวงทดสอบ");
        const postcode = page.locator("form input[placeholder*='รหัสไปรษณีย์'], form input[name='postcode']");
        if (await postcode.count()) await postcode.first().fill("10200");
      },
      requiredField: "เช่น พระบรมมหาราชวัง",
    },
  ];

  for (const tab of tabs) {
    test.describe(`8. Admin CRUD - ${tab.menu}`, () => {
      const id = (n: number) => `FUNC-ADMN-${tab.code}-${String(n).padStart(3, "0")}`;

      /**
       * Mock the tab's API. `write` decides the answer to POST/PUT/DELETE.
       * Returns helpers to read the requests that were sent and the alert() messages shown.
       */
      async function setup(page: Page, opts: { rows?: Record<string, unknown>[]; write?: { status: number; message: string } } = {}) {
        await mockAdminShell(page);
        await mockJson(page, "province", provinces);
        await mockJson(page, "district/\\d+", districts);
        await mockJson(page, "subdistrict/\\d+", [tab.row]);
        await mockJson(page, "position", [{ positionID: 1, positionName: "Manager" }]);
        await mockJson(page, "producttype", [{ typeID: 1, typeName: "Gadgets" }]);
        const rows = opts.rows ?? [tab.row];
        const write = opts.write ?? { status: 200, message: "บันทึกสำเร็จ" };
        await page.route(api(tab.api), (route) => {
          const method = route.request().method();
          if (method === "GET") {
            const isDetail = new RegExp(`/${tab.api}/[^/?]+$`).test(new URL(route.request().url()).pathname) && !["district", "subdistrict"].includes(tab.api);
            return route.fulfill({ contentType: "application/json", body: JSON.stringify(isDetail ? rows[0] ?? {} : rows) });
          }
          return route.fulfill({ status: write.status, contentType: "application/json", body: JSON.stringify({ status: write.status < 400, message: write.message }) });
        });
        const sent = trackRequests(page, tab.api);
        const dialogs = trackDialogs(page);
        await page.goto("/admin");
        await openMenu(page, tab.menu);
        if (tab.filters) await tab.filters(page);
        return { sent, dialogs };
      }

      const rowButton = (page: Page, name: string) => page.locator("main table tbody tr").first().getByRole("button", { name });
      const submit = (page: Page) => page.locator("form button[type='submit']").click();

      test(`${id(1)}: Display list of ${tab.api} - Success`, async ({ page }) => {
        await setup(page);
        await expect(page.locator("main table tbody tr")).toHaveCount(1);
        await expect(page.locator("main table")).toContainText(String(Object.values(tab.row)[1]));
      });

      test(`${id(2)}: Display list of ${tab.api} - Empty`, async ({ page }) => {
        await setup(page, { rows: [] });
        await expect(page.locator("main table tbody tr td:not([colspan])")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "แก้ไข" })).toHaveCount(0);
      });

      test(`${id(3)}: Create ${tab.api} - Success`, async ({ page }) => {
        const { sent, dialogs } = await setup(page);
        await page.getByRole("button", { name: tab.addButton }).click();
        await tab.fill(page);
        await submit(page);
        await expect.poll(() => sent("POST").length).toBe(1);
        await expect.poll(() => dialogs.join("|")).toContain("บันทึกสำเร็จ");
      });

      test(`${id(4)}: Create ${tab.api} - Required fields missing`, async ({ page }) => {
        const { sent } = await setup(page);
        await page.getByRole("button", { name: tab.addButton }).click();
        await submit(page);
        await expect(page.locator("form")).toBeVisible(); // dialog stays open
        expect(sent("POST")).toHaveLength(0); // blocked before reaching the API
      });

      test(`${id(5)}: Update ${tab.api} - Success`, async ({ page }) => {
        const { sent, dialogs } = await setup(page);
        await rowButton(page, "แก้ไข").click();
        await byPlaceholder(page, tab.requiredField).fill("แก้ไขแล้ว");
        if (tab.code === "CUST" || tab.code === "EMP") await page.locator("form input[type='password']").fill("1234").catch(() => undefined);
        await submit(page);
        await expect.poll(() => sent("PUT").length).toBe(1);
        expect(sent("PUT")[0].url()).toMatch(new RegExp(`/${tab.api}/${tab.row[tab.key]}$`));
        await expect.poll(() => dialogs.join("|")).toContain("บันทึกสำเร็จ");
      });

      test(`${id(6)}: Update ${tab.api} - Empty required field rejected`, async ({ page }) => {
        const { sent } = await setup(page);
        await rowButton(page, "แก้ไข").click();
        await byPlaceholder(page, tab.requiredField).fill("");
        await submit(page);
        await expect(page.locator("form")).toBeVisible();
        expect(sent("PUT")).toHaveLength(0);
      });

      test(`${id(7)}: Delete ${tab.api} - Success`, async ({ page }) => {
        const { sent, dialogs } = await setup(page, { write: { status: 200, message: "ลบสำเร็จ" } });
        await rowButton(page, "ลบ").click();
        await expect.poll(() => sent("DELETE").length).toBe(1);
        expect(sent("DELETE")[0].url()).toMatch(new RegExp(`/${tab.api}/${tab.row[tab.key]}$`));
        await expect.poll(() => dialogs.join("|")).toContain("ลบสำเร็จ");
      });

      test(`${id(8)}: Delete ${tab.api} - Referenced by other data (error)`, async ({ page }) => {
        const { sent, dialogs } = await setup(page, { write: { status: 409, message: "ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่" } });
        await rowButton(page, "ลบ").click();
        await expect.poll(() => sent("DELETE").length).toBe(1);
        await expect.poll(() => dialogs.join("|")).toContain("ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่");
      });
    });
  }
});
