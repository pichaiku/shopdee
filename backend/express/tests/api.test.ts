/* eslint-disable @typescript-eslint/no-explicit-any */
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Set up mock for mysql2 connection before importing the app
const mockQuery = jest.fn<any, any[]>();
const mockConnect = jest.fn();

const mockConnection = {
  connect: mockConnect,
  query: mockQuery,
};

jest.mock("mysql2", () => ({
  createConnection: () => mockConnection,
}));

// Now import the app
import fs from "fs";
import app from "../src/index";

const SECRET_KEY = process.env.SECRET_KEY ?? "938!938Ab";

// Helper tokens
const adminToken = jwt.sign({ empID: 1, username: "admin", positionID: 1 }, SECRET_KEY);
const staffToken = jwt.sign({ empID: 2, username: "staff", positionID: 2 }, SECRET_KEY);
const customerToken = jwt.sign({ custID: 1, username: "nadech" }, SECRET_KEY);
const otherCustomerToken = jwt.sign({ custID: 2, username: "yaya" }, SECRET_KEY);

describe("Shopdee Express API Test Suite (Jest + Supertest)", () => {
  let writeFileSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Upload endpoints save files with fs.promises.writeFile; keep them out of assets/
    writeFileSpy = jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
  });

  // ==========================================
  // 1. AUTH & PROFILE
  // ==========================================
  describe("1. Authentication & Profile APIs", () => {
    describe("POST /api/register", () => {
      it("should fail validation if username is missing", async () => {
        const res = await request(app).post("/api/register").send({
          username: "",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
        expect(res.status).toBe(400);
        expect(res.body.status).toBe(false);
      });

      it("should fail if password is too short", async () => {
        const res = await request(app).post("/api/register").send({
          username: "johndoe",
          password: "12",
          firstName: "John",
          lastName: "Doe",
        });
        expect(res.status).toBe(400);
      });

      it("should return 409 if username already exists", async () => {
        mockQuery.mockImplementation((sql: string, params: any[], cb: any) => {
          if (sql.includes("SELECT * FROM customer WHERE username=?")) {
            cb(null, [{ custID: 1, username: "existing_user" }]);
          } else {
            cb(null, []);
          }
        });

        const res = await request(app).post("/api/register").send({
          username: "existing_user",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
        expect(res.status).toBe(409);
        expect(res.body.message).toBe("Username already exists");
      });

      it("should register successfully", async () => {
        mockQuery.mockImplementation((sql: string, params: any[], cb: any) => {
          if (sql.includes("SELECT * FROM customer WHERE username=?")) {
            cb(null, []);
          } else if (sql.includes("INSERT INTO customer")) {
            cb(null, { insertId: 10 });
          } else {
            cb(null, []);
          }
        });

        const res = await request(app).post("/api/register").send({
          username: "new_user",
          password: "password123",
          firstName: "John",
          lastName: "Doe",
        });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("POST /api/login", () => {
      const testUser = "active_user";
      const testPass = "correct_password";
      const hashedPassword = bcrypt.hashSync(testPass, 10);

      it("should fail validation if password is empty", async () => {
        const res = await request(app).post("/api/login").send({
          username: testUser,
          password: "",
        });
        expect(res.status).toBe(400);
      });

      it("should fail if user not found", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        const res = await request(app).post("/api/login").send({
          username: "ghost",
          password: "password",
        });
        expect(res.status).toBe(401);
      });

      it("should fail if password mismatch", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ custID: 1, username: testUser, password: hashedPassword }])
        );
        const res = await request(app).post("/api/login").send({
          username: testUser,
          password: "wrong_password",
        });
        expect(res.status).toBe(401);
      });

      it("should log in successfully and return token", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ custID: 1, username: testUser, password: hashedPassword }])
        );
        const res = await request(app).post("/api/login").send({
          username: testUser,
          password: testPass,
        });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.custID).toBe(1);
      });
    });

    describe("GET /api/profile/:id", () => {
      it("should return 401 without token", async () => {
        const res = await request(app).get("/api/profile/1");
        expect(res.status).toBe(401);
      });

      it("should return customer profile with valid token", async () => {
        mockQuery.mockImplementation((sql: string, params: any[], cb: any) => {
          if (sql.includes("FROM customer")) {
            cb(null, [
              {
                custID: 1,
                username: "nadech",
                firstName: "Nadech",
                lastName: "Kugimiya",
                email: "nadech@email.com",
              },
            ]);
          } else {
            cb(null, []);
          }
        });

        const res = await request(app)
          .get("/api/profile/1")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("nadech");
        expect(res.body.status).toBe(true);
      });
    });

    describe("GET /api/customer/image/:filename", () => {
      it("should return 404 if customer image does not exist", async () => {
        const res = await request(app).get("/api/customer/image/non_existent_file.jpg");
        expect(res.status).toBe(404);
        expect(res.body.status).toBe(false);
      });
    });

    describe("POST /api/customer/image/upload/:id", () => {
      it("should reject upload without token", async () => {
        const res = await request(app).post("/api/customer/image/upload/1");
        expect(res.status).toBe(401);
      });

      it("should reject upload without file", async () => {
        const res = await request(app)
          .post("/api/customer/image/upload/1")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("กรุณาเลือกไฟล์");
      });

      it("should successfully upload image file and update customer", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .post("/api/customer/image/upload/1")
          .set("Authorization", `Bearer ${customerToken}`)
          .attach("imageFile", Buffer.from("fake_image_content"), "profile.jpg");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 2. CUSTOMER MANAGEMENT
  // ==========================================
  describe("2. Customer Management APIs", () => {
    describe("GET /api/customer (Admin list)", () => {
      it("should return 403 if not admin/staff", async () => {
        const res = await request(app)
          .get("/api/customer")
          .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });

      it("should return customer list for admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ custID: 1, username: "nadech", firstName: "Nadech" }])
        );

        const res = await request(app)
          .get("/api/customer")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].username).toBe("nadech");
      });
    });

    describe("GET /api/customer/:id", () => {
      it("should return customer detail for admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ custID: 1, firstName: "Nadech", lastName: "K" }])
        );

        const res = await request(app)
          .get("/api/customer/1")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.custID).toBe(1);
      });

      it("should return 404 if customer not found", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        const res = await request(app)
          .get("/api/customer/999")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
      });
    });

    describe("POST /api/customer (Admin create)", () => {
      it("should allow admin to create a customer", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("SELECT * FROM customer WHERE username=?")) {
            cb(null, []);
          } else {
            cb(null, { insertId: 2 });
          }
        });

        const res = await request(app)
          .post("/api/customer")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            username: "newcust",
            password: "1234",
            firstName: "Sompong",
            lastName: "Jaidee",
          });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("PUT /api/customer/:id", () => {
      it("should update customer data", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .put("/api/customer/1")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            firstName: "Nadech Updated",
            lastName: "Kugimiya",
          });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("DELETE /api/customer/:id", () => {
      it("should allow admin to delete a customer", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .delete("/api/customer/1")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 3. ADMIN AUTH & EMPLOYEE MANAGEMENT
  // ==========================================
  describe("3. Admin & Employee APIs", () => {
    describe("POST /api/admin/login", () => {
      const empPass = "admin1234";
      const hashedEmpPass = bcrypt.hashSync(empPass, 10);

      it("should log in employee successfully", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ empID: 1, username: "admin", password: hashedEmpPass, positionID: 1, positionName: "Manager" }])
        );

        const res = await request(app).post("/api/admin/login").send({
          username: "admin",
          password: empPass,
        });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.positionID).toBe(1);
      });
    });

    describe("GET /api/employee", () => {
      it("should return employee list for authorized admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ empID: 1, firstName: "Admin", positionName: "Manager" }])
        );

        const res = await request(app)
          .get("/api/employee")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("GET /api/employee/:id", () => {
      it("should return employee detail", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ empID: 1, firstName: "Admin", positionName: "Manager" }])
        );

        const res = await request(app)
          .get("/api/employee/1")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.empID).toBe(1);
      });
    });

    describe("POST /api/employee", () => {
      it("should create a new employee", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("SELECT * FROM employee WHERE username=?")) {
            cb(null, []);
          } else {
            cb(null, { insertId: 3 });
          }
        });

        const res = await request(app)
          .post("/api/employee")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            username: "staff3",
            firstName: "Somsak",
            lastName: "Dee",
            positionID: 2,
          });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("PUT /api/employee/:id", () => {
      it("should update employee data", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .put("/api/employee/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            firstName: "Super Admin",
          });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("DELETE /api/employee/:id", () => {
      it("should delete employee", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .delete("/api/employee/2")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 4. PRODUCT MANAGEMENT
  // ==========================================
  describe("4. Product APIs", () => {
    describe("GET /api/product", () => {
      it("should return list of products", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ productID: 1, productName: "Laptop", price: 25000 }])
        );

        const res = await request(app).get("/api/product");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].productName).toBe("Laptop");
      });
    });

    describe("GET /api/product/:id", () => {
      it("should return product detail", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ productID: 1, productName: "Laptop", price: 25000 }])
        );

        const res = await request(app).get("/api/product/1");
        expect(res.status).toBe(200);
        expect(res.body.productName).toBe("Laptop");
      });

      it("should return fail status if product not found", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        const res = await request(app).get("/api/product/999");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(false);
        expect(res.body.message).toContain("ไม่พบข้อมูลสินค้า");
      });
    });

    describe("POST /api/product", () => {
      it("should reject product creation without image file", async () => {
        const res = await request(app)
          .post("/api/product")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            productName: "Mouse Wireless",
            price: 590,
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("กรุณาเลือกไฟล์รูปสินค้า");
      });

      it("should create a product with image file upload for admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { insertId: 5 }));

        const res = await request(app)
          .post("/api/product")
          .set("Authorization", `Bearer ${adminToken}`)
          .field("productName", "Mouse Wireless")
          .field("price", 590)
          .field("cost", 300)
          .field("quantity", 50)
          .field("typeID", 1)
          .attach("imageFile", Buffer.from("fake_product_image"), "mouse.jpg");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("PUT /api/product/:id", () => {
      it("should update a product", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .put("/api/product/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .field("productName", "Laptop Pro")
          .field("price", 29900);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("DELETE /api/product/:id", () => {
      it("should delete a product", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .delete("/api/product/1")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 5. PRODUCT TYPES
  // ==========================================
  describe("5. Product Types APIs", () => {
    describe("GET /api/producttype", () => {
      it("should return list of product types", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ typeID: 1, typeName: "Electronics" }])
        );

        const res = await request(app).get("/api/producttype");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("POST /api/producttype", () => {
      it("should create product type", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { insertId: 2 }));

        const res = await request(app)
          .post("/api/producttype")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ typeName: "Gadgets" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("PUT /api/producttype/:id", () => {
      it("should update product type", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .put("/api/producttype/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ typeName: "Home Electronics" });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("DELETE /api/producttype/:id", () => {
      it("should delete product type", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .delete("/api/producttype/1")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 6. CART & ORDER MANAGEMENT
  // ==========================================
  describe("6. Cart & Order APIs", () => {
    describe("POST /api/makeorder (Add to cart)", () => {
      it("should add product to existing open cart", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("FROM orders WHERE custID")) {
            cb(null, [{ orderID: 100 }]);
          } else if (sql.includes("SELECT COUNT(*) AS orderdetailcount")) {
            cb(null, [{ orderdetailcount: 1 }]);
          } else {
            cb(null, { affectedRows: 1 });
          }
        });

        const res = await request(app)
          .post("/api/makeorder")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({
            custID: 1,
            productID: 1,
            quantity: 2,
            price: 500,
          });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("success");
      });
    });

    describe("GET /api/cart/:id", () => {
      it("should return cart summary", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, totalPrice: 1000, totalQuantity: 2 }])
        );

        const res = await request(app)
          .get("/api/cart/1")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("GET /api/cart/product/:id", () => {
      it("should return cart items", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, productID: 1, productName: "Laptop", quantity: 1, price: 25000 }])
        );

        const res = await request(app)
          .get("/api/cart/product/1")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("PUT /api/cart/product/:id", () => {
      it("should update quantity of product in cart", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("SELECT orders.orderID")) {
            cb(null, [{ orderID: 100 }]);
          } else {
            cb(null, { affectedRows: 1 });
          }
        });

        const res = await request(app)
          .put("/api/cart/product/1")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ productID: 1, quantity: 3 });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("DELETE /api/cart/product/:id", () => {
      it("should remove item from cart", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .delete("/api/cart/product/1")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ orderID: 100, productID: 1 });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("POST /api/confirmorder", () => {
      it("should confirm order and update status to 1", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .post("/api/confirmorder")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ custID: 1, orderID: 100 });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("POST /api/confirmpayment", () => {
      it("should reject payment confirmation with missing parameters", async () => {
        const res = await request(app)
          .post("/api/confirmpayment")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ custID: 1, orderID: 100 });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("ข้อมูลไม่ครบถ้วน");
      });
    });

    describe("POST /api/payment (Slip upload)", () => {
      it("should accept payment slip submission", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .post("/api/payment")
          .set("Authorization", `Bearer ${customerToken}`)
          .field("custID", "1")
          .field("orderID", "100")
          .field("price", "1500")
          .attach("slipFile", Buffer.from("fake_slip_data"), "slip.jpg");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("success");
        expect(writeFileSpy).toHaveBeenCalledTimes(1);
        expect(String(writeFileSpy.mock.calls[0][0])).toMatch(/assets[\\/]payment[\\/]slip\d+\.jpg$/);
      });
    });

    describe("GET /api/history/:id", () => {
      it("should return customer order history", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, statusID: 3, totalPrice: 1500 }])
        );

        const res = await request(app)
          .get("/api/history/1")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("GET /api/orderinfo/:custID/:orderID", () => {
      it("should return order info for specific customer order", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, custID: 1, firstName: "Nadech" }])
        );

        const res = await request(app)
          .get("/api/orderinfo/1/100")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("GET /api/orderdetail/:custID/:orderID", () => {
      it("should return order item details", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, productID: 1, productName: "Laptop", quantity: 1 }])
        );

        const res = await request(app)
          .get("/api/orderdetail/1/100")
          .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("GET /api/admin/order/status", () => {
      it("should return all order statuses for admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [
            { statusID: 1, statusName: "Pending" },
            { statusID: 2, statusName: "Checking" },
          ])
        );

        const res = await request(app)
          .get("/api/admin/order/status")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("POST /api/admin/order/status", () => {
      it("should update order status by admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));

        const res = await request(app)
          .post("/api/admin/order/status")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ orderID: 100, statusID: 3 });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("GET /api/admin/history", () => {
      it("should return all orders for admin history", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ orderID: 100, statusID: 3, totalQuantity: 2 }])
        );

        const res = await request(app)
          .get("/api/admin/history")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });
  });

  // ==========================================
  // 7. REFERENCE DATA (Provinces, Positions, Districts, Subdistricts)
  // ==========================================
  describe("7. Reference Data APIs", () => {
    describe("Province APIs (/api/province)", () => {
      it("GET /api/province should return province list", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ provinceID: "10", provinceName: "กรุงเทพมหานคร" }])
        );
        const res = await request(app).get("/api/province");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it("POST /api/province should create province", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .post("/api/province")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ provinceID: "99", provinceName: "เมืองใหม่" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("PUT /api/province/:id should update province", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .put("/api/province/99")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ provinceName: "เมืองใหม่ ปรับปรุง" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("DELETE /api/province/:id should delete province", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .delete("/api/province/99")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("Position APIs (/api/position)", () => {
      it("GET /api/position should return positions", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ positionID: 1, positionName: "Manager" }])
        );
        const res = await request(app).get("/api/position");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it("POST /api/position should create position", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { insertId: 3 }));
        const res = await request(app)
          .post("/api/position")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ positionName: "Supervisor" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("PUT /api/position/:id should update position", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .put("/api/position/3")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ positionName: "Senior Supervisor" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("DELETE /api/position/:id should delete position", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .delete("/api/position/3")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("District APIs (/api/district)", () => {
      it("GET /api/district/:provinceID should return districts", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ districtID: "1001", districtName: "พระนคร", provinceID: "10" }])
        );
        const res = await request(app).get("/api/district/10");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it("POST /api/district should create district", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ districtID: "9901", districtName: "อำเภอเมืองใหม่", provinceID: "99" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("PUT /api/district/:id should update district", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .put("/api/district/9901")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ districtName: "อำเภอเมืองใหม่ 2", provinceID: "99" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("DELETE /api/district/:id should delete district", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .delete("/api/district/9901")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });

    describe("Subdistrict APIs (/api/subdistrict)", () => {
      it("GET /api/subdistrict/:districtID should return subdistricts", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [{ subdistrictID: "100101", subdistrictName: "พระบรมมหาราชวัง", districtID: "1001" }])
        );
        const res = await request(app).get("/api/subdistrict/1001");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it("POST /api/subdistrict should create subdistrict", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .post("/api/subdistrict")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ subdistrictID: "990101", subdistrictName: "ตำบลเมืองใหม่", districtID: "9901" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("PUT /api/subdistrict/:id should update subdistrict", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .put("/api/subdistrict/990101")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ subdistrictName: "ตำบลเมืองใหม่ 2", districtID: "9901" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });

      it("DELETE /api/subdistrict/:id should delete subdistrict", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, { affectedRows: 1 }));
        const res = await request(app)
          .delete("/api/subdistrict/990101")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
      });
    });
  });

  // ==========================================
  // 8. DASHBOARD OVERVIEW & REPORTS
  // ==========================================
  describe("8. Dashboard Overview & Reports APIs", () => {
    describe("GET /api/admin/overview", () => {
      it("should return overview stats counts for admin", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("FROM customer")) cb(null, [{ customerCount: 15 }]);
          else if (sql.includes("FROM employee")) cb(null, [{ employeeCount: 3 }]);
          else if (sql.includes("FROM producttype")) cb(null, [{ typeCount: 5 }]);
          else if (sql.includes("FROM product")) cb(null, [{ productCount: 42 }]);
          else cb(null, [{ count: 0 }]);
        });

        const res = await request(app)
          .get("/api/admin/overview")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.customerCount).toBe(15);
        expect(res.body.employeeCount).toBe(3);
        expect(res.body.productCount).toBe(42);
      });
    });

    describe("GET /api/reports/sales/year", () => {
      it("should return yearly sales report for staff/admin", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [
            { year: 2025, totalSales: 150000 },
            { year: 2026, totalSales: 240000 },
          ])
        );

        const res = await request(app)
          .get("/api/reports/sales/year")
          .set("Authorization", `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(2);
      });
    });

    describe("GET /api/reports/sales/month", () => {
      it("should return monthly sales report", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [
            { month: 1, totalSales: 20000 },
            { month: 2, totalSales: 35000 },
          ])
        );

        const res = await request(app)
          .get("/api/reports/sales/month?year=2026")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].month).toBe(1);
      });
    });

    describe("GET /api/reports/products/top", () => {
      it("should return top selling products", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [
            { productID: 1, productName: "Gaming Laptop", revenue: 150000 },
            { productID: 2, productName: "Wireless Earbuds", revenue: 45000 },
          ])
        );

        const res = await request(app)
          .get("/api/reports/products/top?limit=5")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].productName).toBe("Gaming Laptop");
      });
    });
  });

  // ==========================================
  // 9. HEALTH, BEST SELLERS, CARD PAYMENT, ADMIN ORDER
  // ==========================================
  describe("9. Health, Best sellers, Card payment & Admin order APIs", () => {
    describe("GET /api/health", () => {
      it("should return ok when the database answers", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, [{ 1: 1 }]));
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", service: "express", database: "ok" });
      });

      it("should return 503 when the database is down", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(new Error("ECONNREFUSED")));
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(503);
        expect(res.body.database).toBe("down");
      });
    });

    describe("GET /api/product/popular", () => {
      it("should return best sellers ordered by totalSold with the requested limit", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) =>
          cb(null, [
            { productID: 3, productName: "Hoodie", totalSold: 12 },
            { productID: 1, productName: "Cap", totalSold: 0 },
          ])
        );
        const res = await request(app).get("/api/product/popular?limit=5");
        expect(res.status).toBe(200);
        expect(res.body[0].productName).toBe("Hoodie");
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain("ORDER BY totalSold DESC");
        expect(params).toEqual([5]);
      });

      it("should clamp the limit between 1 and 50", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        await request(app).get("/api/product/popular?limit=999");
        expect(mockQuery.mock.calls[0][1]).toEqual([50]);
        await request(app).get("/api/product/popular?limit=abc");
        expect(mockQuery.mock.calls[1][1]).toEqual([10]);
      });

      it("should not be shadowed by /api/product/:id", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        await request(app).get("/api/product/popular");
        expect(mockQuery.mock.calls[0][0]).toContain("totalSold");
      });
    });

    describe("POST /api/confirmpayment (Omise card)", () => {
      const fetchMock = jest.fn();
      const originalFetch = global.fetch;

      beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock as any;
      });
      afterAll(() => {
        global.fetch = originalFetch;
      });

      const pay = (body: any, token = customerToken) =>
        request(app).post("/api/confirmpayment").set("Authorization", `Bearer ${token}`).send(body);

      it("should reject paying for another customer's order", async () => {
        const res = await pay({ custID: 2, orderID: 100, paymentToken: "tokn_test" });
        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("should return 404 when the order does not belong to the customer", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, []));
        const res = await pay({ custID: 1, orderID: 999, paymentToken: "tokn_test" });
        expect(res.status).toBe(404);
        expect(mockQuery.mock.calls[0][1]).toEqual([999, 1]);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("should return 400 when the order is not waiting for payment", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, [{ statusID: 3, totalPrice: 500 }]));
        const res = await pay({ custID: 1, orderID: 100, paymentToken: "tokn_test" });
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("should charge the amount from the database, not the one sent by the client", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("SUM(orderdetail.quantity * orderdetail.price)")) cb(null, [{ statusID: 1, totalPrice: 1250.5 }]);
          else cb(null, { affectedRows: 1 });
        });
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "successful", id: "chrg_test" }) });

        const res = await pay({ custID: 1, orderID: 100, paymentToken: "tokn_test", amount: 100 });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.omise.co/charges");
        const sent = new URLSearchParams(String(init.body));
        expect(sent.get("amount")).toBe("125050"); // 1,250.50 THB in satang (client sent 100)
        expect(sent.get("card")).toBe("tokn_test");
        const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
        expect(sqls.some((q) => q.startsWith("UPDATE orders SET statusID"))).toBe(true);
        const insert = mockQuery.mock.calls.find((c) => String(c[0]).startsWith("INSERT INTO payment"));
        expect(insert?.[1]).toEqual([100, 1250.5]);
      });

      it("should return 402 and keep the order unpaid when the charge fails", async () => {
        mockQuery.mockImplementation((_s: string, _p: any[], cb: any) => cb(null, [{ statusID: 1, totalPrice: 300 }]));
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "failed", failure_message: "insufficient fund" }) });

        const res = await pay({ custID: 1, orderID: 100, paymentToken: "tokn_test" });

        expect(res.status).toBe(402);
        const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
        expect(sqls.some((q) => q.startsWith("UPDATE orders"))).toBe(false);
      });
    });

    describe("GET /api/orderinfo/:orderID (admin order detail)", () => {
      it("should join only the latest slip and return slip metadata", async () => {
        mockQuery.mockImplementation((sql: string, _p: any[], cb: any) => {
          if (sql.includes("FROM orders INNER JOIN customer")) {
            cb(null, [{ orderID: 19, slipFile: "slip_new.jpg", channelID: 1, paymentDate: "2026-11-10 13:30:17", slipCount: 2 }]);
          } else {
            cb(null, [{ productID: 1, productName: "Cap", quantity: 1, price: 200 }]);
          }
        });

        const res = await request(app).get("/api/orderinfo/19").set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body[0].slipFile).toBe("slip_new.jpg");
        expect(res.body[0].slipCount).toBe(2);
        expect(res.body[0].orderDetails).toHaveLength(1);
        const sql = String(mockQuery.mock.calls[0][0]);
        expect(sql).toContain("ORDER BY p.paymentDate DESC, p.paymentID DESC LIMIT 1");
        expect(sql).toContain("p.slipFile IS NOT NULL");
      });

      it("should be forbidden for customers", async () => {
        const res = await request(app).get("/api/orderinfo/19").set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });
    });
  });
});
