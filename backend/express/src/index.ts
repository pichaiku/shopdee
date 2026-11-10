import dotenv from "dotenv";
dotenv.config();

import express, { type Request, type Response, type NextFunction } from "express";
import mysql, { type Connection } from "mysql2";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import fileUpload, { type FileArray, type UploadedFile } from "express-fileupload";
import path from "path";
import crypto from "crypto";
import { body, validationResult } from "express-validator";
import cors from "cors";

const app = express();
const HOST_PORT = Number(process.env.HOST_PORT ?? 4000);
const SECRET_KEY = process.env.SECRET_KEY ?? "938!938Ab";
const OMISE_SECRET_KEY = process.env.omise_secret_key ?? "";

const db: Connection = mysql.createConnection({
  host: process.env.DB_HOST ?? "mysql",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "1234",
  database: process.env.DB_NAME ?? "shopdee",
  port: Number(process.env.DB_PORT ?? 3306),
});
db.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(fileUpload());
app.disable('x-powered-by');

if (process.env.NODE_ENV !== "production") {
  const swaggerUi = require("swagger-ui-express");
  const swaggerFile = require("./swagger-output.json");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));
}

interface TokenPayload extends JwtPayload {
  empID?: number;
  custID?: number;
  username?: string;
  positionID?: number;
}

interface AuthRequest extends Request {
  user?: TokenPayload;
  files?: FileArray;
}

const getUploadedFile = (req: Request, fieldName: string): UploadedFile | undefined => {
  const authReq = req as AuthRequest;
  const file = authReq.files?.[fieldName];
  return Array.isArray(file) ? file[0] : file;
};

const verifyToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, SECRET_KEY);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as TokenPayload;
};

const query = <T = any>(sql: string, params: unknown[] = []): Promise<T> =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results as T);
      }
    });
  });

const validateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Access denied" });
    return;
  }

  try {
    authReq.user = verifyToken(token);
    next();
  } catch {
    res.status(403).json({ message: "Invalid token" });
  }
};

app.post(
  "/api/register",
  [
    body("username").isString().notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 4 }).withMessage("Password must be at least 4 characters"),
    body("firstName").isString().notEmpty().withMessage("First name is required"),
    body("lastName").isString().notEmpty().withMessage("Last name is required"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ message: "Validation errors", errors: errors.array(), status: false });
    }

    const { username, password, firstName, lastName } = req.body;
    try {
      const existingUser = await query<any[]>("SELECT * FROM customer WHERE username=?", [username]);
      if (existingUser.length > 0) {
        return res.status(409).send({ message: "Username already exists", status: false });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      await query(
        "INSERT INTO customer (username, password, firstName, lastName) VALUES (?, ?, ?, ?)",
        [username, password_hash, firstName, lastName]
      );
      res.send({ message: "Registration successful", status: true });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/api/login",
  [
    body("username").isString().notEmpty().withMessage("Username is required"),
    body("password").isString().notEmpty().withMessage("Password is required"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ message: "Validation errors", errors: errors.array(), status: false });
    }
    //console.log('Request body ที่ส่งมา:', req.body); // เช็คข้อมูลที่ส่งเข้ามา

    const { username, password } = req.body;
    try {
      const customer = await query<any[]>("SELECT * FROM customer WHERE username=? AND isActive = 1", [username]);
      if (customer.length === 0) {
        return res.status(401).send({ message: "Invalid username or password", status: false });
      }

      const isPasswordValid = bcrypt.compareSync(password, customer[0].password);
      if (!isPasswordValid) {
        return res.status(401).send({ message: "Invalid username or password", status: false });
      }

      const token = jwt.sign({ custID: customer[0].custID, username: customer[0].username }, SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send({
        custID: customer[0].custID,
        username,
        email: customer[0].email,
        token,
        message: "Login successful",
        status: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get("/api/profile/:id", validateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const custID = req.params.id;
  if (custID != String(authReq.user?.custID)) {
    return res.status(403).send({ message: "Access denied", status: false });
  }

  try {
    const customer = await query<any[]>(
      `SELECT custID, username, firstName, lastName, address, mobilePhone, gender, email, imageFile,
        IF(birthdate IS NOT NULL, DATE_FORMAT(birthdate, '%Y-%m-%d'), NULL) AS birthdate
        FROM customer WHERE custID = ? AND isActive = 1`,
      [custID]
    );

    if (customer.length === 0) {
      return res.status(404).send({ message: "Customer not found", status: false });
    }

    res.send({ ...customer[0], message: "Success", status: true });
  } catch (err) {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/customer/image/:filename", (req: Request, res: Response) => {
  const filepath = path.join(__dirname, "../assets/customer", req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send({ message: "Image not found", status: false });
  }
  res.sendFile(filepath);
});

app.post("/api/customer/image/upload/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const custID = req.params.id;
  try {
    const decode = verifyToken(token);
    if (custID != String(decode.custID) && decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }


    const imageFile = getUploadedFile(req, "imageFile");
    if (!imageFile) {
      return res.status(400).send({ message: "กรุณาเลือกไฟล์รูปภาพ", status: false });
    }

    const fileNameParts = imageFile.name.split(".");
    const fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
    const imagePath = path.join(__dirname, "../assets/customer", fileName);

    //res.status(200).send({ message: imagePath, status: true });
    await fs.promises.writeFile(imagePath, imageFile.data);
    await query("UPDATE customer SET imageFile = ? WHERE custID = ?", [fileName, custID]);
    res.send({ message: "อัปโหลดไฟล์รูปภาพเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/customer", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const result = await query<any[]>("SELECT * FROM customer");
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/customer/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT customer.*, DATE_FORMAT(birthdate, '%Y-%m-%d') AS birthdate FROM customer WHERE custID = ? AND isActive = 1`;
    const customer = await query<any[]>(sql, [custID]);
    if (customer.length === 0) {
      return res.status(404).send({ message: "ไม่พบข้อมูลลูกค้า", status: false });
    }

    res.send({ ...customer[0], message: "success", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.put("/api/customer/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const custID = req.params.id;

  try {
    const decode = verifyToken(token);
    if (custID != String(decode.custID) && decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    let fileName = "";
    if (imageFile) {
      const fileNameParts = imageFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/customer", fileName);
      await fs.promises.writeFile(imagePath, imageFile.data);
    }

    let { username, password, firstName, lastName, email, gender, birthdate, address, homePhone, mobilePhone, subdistrictID } = req.body;
    if (gender == "-1") {
      gender = null;
    }
    if (birthdate == "") {
      birthdate = null;
    }
    if (subdistrictID == "" || subdistrictID == "-1") {
      subdistrictID = null;
    }

    let sql = `UPDATE customer SET username = ?, firstName = ?, lastName = ?, email = ?, gender = ?, birthdate = ?, address = ?, homePhone = ?, mobilePhone = ?, subdistrictID = ?`;
    const params: unknown[] = [username, firstName, lastName, email, gender, birthdate, address, homePhone, mobilePhone, subdistrictID];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      sql += ", password = ?";
      params.push(password_hash);
    }

    if (fileName) {
      sql += ", imageFile = ?";
      params.push(fileName);
    }

    sql += " WHERE custID = ?";
    params.push(custID);

    await query(sql, params);
    res.send({ message: "แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.delete("/api/customer/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (custID != String(decode.custID) && decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("DELETE FROM customer WHERE custID = ?", [custID]);
    res.send({ message: "ลบข้อมูลลูกค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.post("/api/admin/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const employeeRecords = await query<any[]>("SELECT * FROM employee WHERE username=? AND isActive = 1", [username]);
  if (employeeRecords.length === 0) {
    return res.send({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", status: false });
  }

  const employee = employeeRecords[0];
  const empID = employee.empID;
  const password_hash = employee.password;
  const positionID = employee.positionID;

  const row = await query<any[]>(
    "SELECT loginAttempt FROM employee WHERE username=? AND isActive = 1 AND lastAttemptTime >= CURRENT_TIMESTAMP - INTERVAL 24 HOUR",
    [username]
  );
  let loginAttempt = 0;
  if (row.length > 0) {
    loginAttempt = row[0].loginAttempt ?? 0;
    if (loginAttempt >= 3) {
      return res.send({ message: "บัญชีคุณถูกล๊อก เนื่องจากมีการพยายามเข้าสู่ระบบเกินกำหนด", status: false });
    }
  } else {
    await query("UPDATE employee SET loginAttempt = 0, lastAttemptTime=NULL WHERE username=? AND isActive = 1", [username]);
  }

  if (bcrypt.compareSync(password, password_hash)) {
    await query("UPDATE employee SET loginAttempt = 0, lastAttemptTime=NULL WHERE username=? AND isActive = 1", [username]);
    const token = jwt.sign({ empID, username, positionID }, SECRET_KEY, { expiresIn: "1h" });
    res.send({ ...employee, token, message: "เข้าสู่ระบบสำเร็จ", status: true });
  } else {
    const lastAttemptTime = new Date();
    await query("UPDATE employee SET loginAttempt = loginAttempt + 1, lastAttemptTime=? WHERE username=? AND isActive = 1", [lastAttemptTime, username]);
    if (loginAttempt >= 2) {
      res.send({ message: "บัญชีคุณถูกล๊อก เนื่องจากมีการพยายามเข้าสู่ระบบเกินกำหนด", status: false });
    } else {
      res.send({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", status: false });
    }
  }
});

app.get("/api/employee", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT employee.*, position.positionName FROM employee INNER JOIN position ON employee.positionID = position.positionID ORDER BY employee.empID ASC`;
    const result = await query<any[]>(sql);
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/employee/:id", async (req: Request, res: Response) => {
  const empID = req.params.id;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (empID != String(decode.empID) && decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT employee.*, position.positionName FROM employee INNER JOIN position ON employee.positionID = position.positionID WHERE employee.empID = ? AND employee.isActive = 1`;
    const employee = await query<any[]>(sql, [empID]);
    if (employee.length === 0) {
      return res.status(404).send({ message: "ไม่พบข้อมูลพนักงาน", status: false });
    }

    res.send({ ...employee[0], message: "success", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/employee/image/:filename", (req: Request, res: Response) => {
  const filepath = path.join(__dirname, "../assets/employee", req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send({ message: "Image not found", status: false });
  }
  res.sendFile(filepath);
});

function generateRandomPassword(length: number): string {
  return crypto.randomBytes(length).toString("base64").slice(0, length).replace(/\+/g, "A").replace(/\//g, "B");
}

app.post("/api/employee", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    let fileName = "";
    if (imageFile) {
      const fileNameParts = imageFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/employee", fileName);
      await fs.promises.writeFile(imagePath, imageFile.data);
    }

    const { username, password, firstName, lastName, email, gender, positionID, mobilePhone } = req.body;
    const existingEmployee = await query<any[]>("SELECT * FROM employee WHERE username=?", [username]);
    if (existingEmployee.length > 0) {
      return res.send({ message: "ชื่อผู้ใช้ซ้ำ", status: false });
    }

    const finalPassword = password || generateRandomPassword(8);
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(finalPassword, salt);
    const posId = positionID ? Number(positionID) : 2;
    const phone = mobilePhone || null;

    await query(
      `INSERT INTO employee(username, password, firstName, lastName, email, gender, imageFile, positionID, mobilePhone) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password_hash, firstName, lastName, email, gender, fileName, posId, phone]
    );

    res.send({ message: "เพิ่มข้อมูลพนักงานเรียบร้อยแล้ว", status: true, tempPassword: finalPassword });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.put("/api/employee/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  const empID = req.params.id;

  try {
    const decode = verifyToken(token);
    if (empID != String(decode.empID) && decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    let fileName = "";
    if (imageFile) {
      const fileNameParts = imageFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/employee", fileName);
      await fs.promises.writeFile(imagePath, imageFile.data);
    }

    const { password, username, firstName, lastName, email, gender, mobilePhone, positionID } = req.body;
    let sql = "UPDATE employee SET username = ?, firstName = ?, lastName = ?, email = ?, gender = ?, mobilePhone = ?";
    const params: unknown[] = [username, firstName, lastName, email, gender, mobilePhone || null];

    if (decode.positionID === 1 && positionID !== undefined) {
      sql += ", positionID = ?";
      params.push(Number(positionID));
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      sql += ", password = ?";
      params.push(password_hash);
    }

    if (fileName) {
      sql += ", imageFile = ?";
      params.push(fileName);
    }

    sql += " WHERE empID = ?";
    params.push(empID);

    await query(sql, params);
    res.send({ message: "แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.delete("/api/employee/:id", async (req: Request, res: Response) => {
  const empID = req.params.id;
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("DELETE FROM employee WHERE empID = ?", [empID]);
    res.send({ message: "ลบข้อมูลพนักงานเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

// Health check (used by Prometheus blackbox-exporter): 200 when the API and MySQL are reachable
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", service: "express", database: "ok" });
  } catch {
    res.status(503).json({ status: "error", service: "express", database: "down" });
  }
});

app.get("/api/product", async (req: Request, res: Response) => {
  const sql = `SELECT product.*, producttype.typeName FROM product INNER JOIN producttype ON product.typeID = producttype.typeID ORDER BY product.productID ASC`;
  try {
    const result = await query<any[]>(sql);
    if (result.length > 0) {
      res.send(result);
    } else {
      res.send({ message: "fail", status: false });
    }
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

// Best-selling products (public). Must stay above /api/product/:id.
// Products never ordered are included last (totalSold = 0) so the list can always be filled.
app.get("/api/product/popular", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const sql = `SELECT product.*, producttype.typeName, COALESCE(sold.totalSold, 0) AS totalSold
    FROM product
    INNER JOIN producttype ON product.typeID = producttype.typeID
    LEFT JOIN (
      SELECT od.productID, SUM(od.quantity) AS totalSold
      FROM orderdetail od
      INNER JOIN orders o ON o.orderID = od.orderID
      WHERE o.statusID <> 0
      GROUP BY od.productID
    ) sold ON sold.productID = product.productID
    ORDER BY totalSold DESC, product.productID ASC
    LIMIT ?`;
  try {
    const result = await query<any[]>(sql, [limit]);
    res.json(result.map((row) => ({ ...row, totalSold: Number(row.totalSold) })));
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/product/:id", async (req: Request, res: Response) => {
  const sql = `SELECT product.*, producttype.typeName FROM product INNER JOIN producttype ON product.typeID = producttype.typeID WHERE product.productID = ?`;
  try {
    const result = await query<any[]>(sql, [req.params.id]);
    if (result.length > 0) {
      res.json({ ...result[0], message: "success", status: true });
    } else {
      res.send({ message: "ไม่พบข้อมูลสินค้า", status: false });
    }
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/product/image/:filename", (req: Request, res: Response) => {
  const filepath = path.join(__dirname, "../assets/product", req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send({ message: "Image not found", status: false });
  }
  res.sendFile(filepath);
});

app.post("/api/product", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    if (!imageFile) {
      return res.status(400).send({ message: "กรุณาเลือกไฟล์รูปสินค้า", status: false });
    }

    const fileNameParts = imageFile.name.split(".");
    const fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
    const imagePath = path.join(__dirname, "../assets/product", fileName);
    await fs.promises.writeFile(imagePath, imageFile.data);

    const { productName, productDetail, price, cost, quantity, typeID } = req.body;
    await query(
      `INSERT INTO product(productName, productDetail, price, cost, quantity, imageFile, typeID) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [productName, productDetail, price, cost, quantity, fileName, typeID]
    );

    res.send({ message: "เพิ่มข้อมูลสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.put("/api/product/:id", async (req: Request, res: Response) => {
  const productID = req.params.id;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    let fileName = "";
    if (imageFile) {
      const fileNameParts = imageFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/product", fileName);
      await fs.promises.writeFile(imagePath, imageFile.data);
    }

    const { productName, productDetail, price, cost, quantity, typeID } = req.body;
    let sql = `UPDATE product SET productName = ?, productDetail = ?, price = ?, cost = ?, quantity = ?, typeID = ?`;
    const params: unknown[] = [productName, productDetail, price, cost, quantity, typeID];

    if (fileName) {
      sql += ", imageFile = ?";
      params.push(fileName);
    }

    sql += " WHERE productID = ?";
    params.push(productID);

    await query(sql, params);
    res.send({ message: "แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.delete("/api/product/:id", async (req: Request, res: Response) => {
  const productID = req.params.id;
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";

  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("DELETE FROM product WHERE productID = ?", [productID]);
    res.send({ message: "ลบข้อมูลสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/producttype", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM producttype");
    if (result.length > 0) {
      res.send(result);
    } else {
      res.send({ message: "fail", status: false });
    }
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/producttype/:id", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM producttype WHERE typeID = ?", [req.params.id]);
    if (result.length > 0) {
      res.json({ ...result[0], message: "success", status: true });
    } else {
      res.send({ message: "ไม่พบข้อมูลประเภทสินค้า", status: false });
    }
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.post("/api/producttype", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const { typeName } = req.body;
    await query(`INSERT INTO producttype(typeName) VALUES(?)`, [typeName]);
    res.send({ message: "เพิ่มข้อมูลประเภทสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.put("/api/producttype/:id", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const { typeName } = req.body;
    await query(`UPDATE producttype SET typeName = ? WHERE typeID = ?`, [typeName, req.params.id]);
    res.send({ message: "แก้ไขข้อมูลประเภทสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.delete("/api/producttype/:id", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("DELETE FROM producttype WHERE typeID = ?", [req.params.id]);
    res.send({ message: "ลบข้อมูลประเภทสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.post("/api/makeorder", async (req: Request, res: Response) => {
  const { custID, productID, quantity, price } = req.body;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const existingOrder = await query<any[]>("SELECT orderID FROM orders WHERE custID = ? AND statusID = 0", [custID]);
    if (existingOrder.length === 0) {
      const insertResult = await query<any>("INSERT INTO orders (custID,statusID) VALUES(?, 0)", [custID]);
      const orderID = insertResult.insertId;
      await query("INSERT INTO orderdetail VALUES(?, ?, ?, ?)", [orderID, productID, quantity, price]);
    } else {
      const orderID = existingOrder[0].orderID;
      const orderDetailCount = await query<any[]>(
        "SELECT COUNT(*) AS orderdetailcount FROM orderdetail WHERE orderID = ? AND productID = ?",
        [orderID, productID]
      );
      if (orderDetailCount[0].orderdetailcount === 0) {
        await query("INSERT INTO orderdetail VALUES(?, ?, ?, ?)", [orderID, productID, quantity, price]);
      } else {
        await query(
          "UPDATE orderdetail SET quantity = quantity + ? WHERE orderID = ? AND productID = ?",
          [quantity, orderID, productID]
        );
      }
    }

    res.send({ message: "success", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

const getCurrentTime = (): string => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const hours = String(currentDate.getHours()).padStart(2, "0");
  const minutes = String(currentDate.getMinutes()).padStart(2, "0");
  const seconds = String(currentDate.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

app.post("/api/confirmorder", async (req: Request, res: Response) => {
  const { custID, orderID } = req.body;
  const orderDate = getCurrentTime();
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("UPDATE orders SET orderDate = ?, statusID = 1 WHERE orderID = ?", [orderDate, orderID]);
    res.send({ message: "ยืนยันการสั่งซื้อเรียบร้อย", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.post("/api/confirmpayment", async (req: Request, res: Response) => {
  const { custID, orderID, paymentToken } = req.body;

  if (!paymentToken || !orderID || !custID) {
    return res.status(400).send({ message: "ข้อมูลไม่ครบถ้วน", status: false });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID) && decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    if (!OMISE_SECRET_KEY) {
      return res.status(500).send({ message: "Omise secret key not configured", status: false });
    }

    // Never trust the amount sent by the client: compute it from the order itself
    const orderRows = await query<any[]>(
      `SELECT orders.statusID, SUM(orderdetail.quantity * orderdetail.price) AS totalPrice
       FROM orders INNER JOIN orderdetail ON orders.orderID = orderdetail.orderID
       WHERE orders.orderID = ? AND orders.custID = ?
       GROUP BY orders.orderID, orders.statusID`,
      [orderID, custID]
    );
    if (orderRows.length === 0) {
      return res.status(404).send({ message: "ไม่พบคำสั่งซื้อ", status: false });
    }
    if (Number(orderRows[0].statusID) !== 1) {
      return res.status(400).send({ message: "คำสั่งซื้อนี้ไม่อยู่ในสถานะรอชำระเงิน", status: false });
    }
    const amount = Math.round(Number(orderRows[0].totalPrice) * 100); // satang

    const chargeResponse = await fetch("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${OMISE_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "amount": String(amount),
        "currency": "thb",
        "card": paymentToken,
        "description": `Order #${orderID}`,
      }),
    });

    const chargeData = await chargeResponse.json();
    if (!chargeResponse.ok || chargeData.status !== "successful") {
      const message = chargeData.message ?? chargeData.error?.message ?? "การชำระเงินไม่สำเร็จ";
      return res.status(402).send({ message, status: false, chargeData });
    }

    const amountInBaht = amount / 100;
    await query("UPDATE orders SET statusID = ? WHERE orderID = ?", [3, orderID]);
    await query("INSERT INTO payment(orderID, price) VALUES (?, ?)", [orderID, amountInBaht]);
    res.send({ message: "ชำระเงินเรียบร้อยแล้ว", status: true, chargeData });
  } catch (error) {
    console.error("confirmpayment error:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
    }
    res.status(500).send({ message: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์ในการชำระเงิน", status: false, error: String(error) });
  }
});

app.get("/api/cart/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orders.orderID, orderDate, shipDate, receiveDate, orders.custID, statusID, customer.firstName,customer.lastName,customer.address,customer.mobilePhone, SUM(orderdetail.quantity) AS totalQuantity, SUM(orderdetail.quantity*orderdetail.price) AS totalPrice, COUNT(orderdetail.orderID) AS itemCount FROM orders INNER JOIN customer ON customer.custID=orders.custID INNER JOIN orderdetail ON orders.orderID=orderdetail.orderID WHERE orders.custID=? AND orders.statusID=0 GROUP BY orders.orderID, orderDate, shipDate, receiveDate, orders.custID, statusID, customer.firstName,customer.lastName,customer.address,customer.mobilePhone`;
    const results = await query<any[]>(sql, [custID]);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/cart/product/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orderdetail.orderID, orderdetail.productID, orderdetail.quantity, orderdetail.price, product.productName, product.imageFile FROM orderdetail INNER JOIN product ON orderdetail.productID=product.productID INNER JOIN orders ON orderdetail.orderID=orders.orderID WHERE orders.custID=? AND orders.statusID=0 GROUP BY orderdetail.orderID, orderdetail.productID, orderdetail.quantity, orderdetail.price, product.productName, product.imageFile`;
    const results = await query<any[]>(sql, [custID]);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.put("/api/cart/product/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  const { productID, quantity } = req.body;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query(
      `UPDATE orderdetail SET quantity = ? WHERE orderID = (SELECT orderID FROM orders WHERE custID = ? AND statusID = 0) AND productID = ?`,
      [quantity, custID, productID]
    );
    res.send({ message: "อัปเดตจำนวนสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.delete("/api/cart/product/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  const { orderID, productID } = req.body;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("DELETE FROM orderdetail WHERE orderID = ? AND productID = ?", [orderID, productID]);
    res.send({ message: "ลบรายการสินค้าเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/history/:id", async (req: Request, res: Response) => {
  const custID = req.params.id;
  const year = req.query.year as string | undefined;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    let sql = `SELECT orders.orderID, IF(orderDate IS NOT NULL, DATE_FORMAT(orderDate, '%Y-%m-%d'), NULL) AS orderDate, IF(shipDate IS NOT NULL, DATE_FORMAT(shipDate, '%Y-%m-%d'), NULL) AS shipDate, IF(receiveDate IS NOT NULL, DATE_FORMAT(receiveDate, '%Y-%m-%d'), NULL) AS receiveDate, orders.custID, orders.statusID,customer.firstName,customer.lastName,orderstatus.statusName, SUM(orderdetail.quantity) AS totalQuantity, SUM(orderdetail.quantity*orderdetail.price) AS totalPrice FROM orders INNER JOIN customer ON customer.custID=orders.custID INNER JOIN orderdetail ON orders.orderID=orderdetail.orderID INNER JOIN orderstatus ON orders.statusID=orderstatus.statusID WHERE orders.custID=? AND orders.statusID<>0`;
    if (year) {
      sql += ` AND SUBSTRING(orders.orderDate,1,4) = '${year}'`;
    }
    sql += ` GROUP BY orders.orderID, orderDate, shipDate, receiveDate, orders.custID, orders.statusID,customer.firstName,customer.lastName,orderstatus.statusName ORDER BY orders.orderID DESC`;
    const results = await query<any[]>(sql, [custID]);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/orderinfo/:custID/:orderID", async (req: Request, res: Response) => {
  const custID = req.params.custID;
  const orderID = req.params.orderID;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orders.orderID, IF(orderDate IS NOT NULL, DATE_FORMAT(orderDate, '%Y-%m-%d'), NULL) AS orderDate, IF(shipDate IS NOT NULL, DATE_FORMAT(shipDate, '%Y-%m-%d'), NULL) AS shipDate, IF(receiveDate IS NOT NULL, DATE_FORMAT(receiveDate, '%Y-%m-%d'), NULL) AS receiveDate, orders.custID, orders.statusID, orderstatus.statusName, customer.firstName,customer.lastName,customer.address,customer.mobilePhone, SUM(orderdetail.quantity) AS totalQuantity, SUM(orderdetail.quantity*orderdetail.price) AS totalPrice FROM orders INNER JOIN customer ON customer.custID=orders.custID INNER JOIN orderdetail ON orders.orderID=orderdetail.orderID INNER JOIN orderstatus ON orders.statusID=orderstatus.statusID WHERE orders.orderID=? GROUP BY orders.orderID, orderDate, shipDate, receiveDate, orders.custID, orders.statusID, orderstatus.statusName, customer.firstName,customer.lastName,customer.address,customer.mobilePhone`;
    const results = await query<any[]>(sql, [orderID]);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/orderdetail/:custID/:orderID", async (req: Request, res: Response) => {
  const custID = req.params.custID;
  const orderID = req.params.orderID;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orderdetail.*,product.productName FROM orderdetail INNER JOIN product ON orderdetail.productID = product.productID WHERE orderID=?`;
    const results = await query<any[]>(sql, [orderID]);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/orderinfo/:orderID", async (req: Request, res: Response) => {
  const orderID = req.params.orderID;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orders.orderID, DATE_FORMAT(orderDate, '%Y-%m-%d %H:%i:%s') AS orderDate, DATE_FORMAT(shipDate, '%Y-%m-%d %H:%i:%s') AS shipDate, DATE_FORMAT(receiveDate, '%Y-%m-%d %H:%i:%s') AS receiveDate, orders.custID, statusID, customer.firstName,customer.lastName,customer.address,customer.mobilePhone, payment.slipFile, payment.channelID, DATE_FORMAT(payment.paymentDate, '%Y-%m-%d %H:%i:%s') AS paymentDate, (SELECT COUNT(*) FROM payment p2 WHERE p2.orderID=orders.orderID AND p2.slipFile IS NOT NULL) AS slipCount, SUM(orderdetail.quantity) AS totalQuantity, SUM(orderdetail.quantity*orderdetail.price) AS totalPrice FROM orders INNER JOIN customer ON customer.custID=orders.custID INNER JOIN orderdetail ON orders.orderID=orderdetail.orderID LEFT JOIN payment ON payment.paymentID = (SELECT p.paymentID FROM payment p WHERE p.orderID=orders.orderID AND p.slipFile IS NOT NULL ORDER BY p.paymentDate DESC, p.paymentID DESC LIMIT 1) WHERE orders.orderID=? GROUP BY orders.orderID, orderDate, shipDate, receiveDate, orders.custID, statusID, customer.firstName,customer.lastName,customer.address,customer.mobilePhone, payment.slipFile, payment.channelID, payment.paymentDate`;
    const orderInfo = await query<any[]>(sql, [orderID]);
    const orderDetails = await query<any[]>(`SELECT orderdetail.*,product.productName FROM orderdetail INNER JOIN product ON orderdetail.productID = product.productID WHERE orderID=?`, [orderID]);
    if (orderInfo.length > 0) {
      orderInfo[0].orderDetails = orderDetails;
    }
    res.json(orderInfo);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.post("/api/admin/order/status", async (req: Request, res: Response) => {
  const { orderID, statusID } = req.body;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    await query("UPDATE orders SET statusID = ? WHERE orderID = ?", [statusID, orderID]);
    res.send({ message: "อัปเดตสถานะคำสั่งซื้อเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/admin/order/status", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const result = await query<any[]>("SELECT * FROM orderstatus");
    if (result.length > 0) {
      res.send(result);
    } else {
      res.send({ message: "fail", status: false });
    }
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/admin/history", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT orders.orderID, orders.custID, orders.statusID, DATE_FORMAT(orderDate, '%Y-%m-%d %H:%i:%s') AS orderDate, DATE_FORMAT(shipDate, '%Y-%m-%d %H:%i:%s') AS shipDate, DATE_FORMAT(receiveDate, '%Y-%m-%d %H:%i:%s') AS receiveDate, CASE WHEN orders.statusID = 1 THEN 'รอการชำระเงิน' WHEN orders.statusID = 2 THEN 'กำลังตรวจสอบการชำระ' WHEN orders.statusID = 3 THEN 'ชำระแล้ว' WHEN orders.statusID = 4 THEN 'กำลังส่งสินค้า' WHEN orders.statusID = 5 THEN 'ส่งสินค้าแล้ว' ELSE 'ไม่ทราบสถานะ' END AS status, customer.firstName,customer.lastName, SUM(orderdetail.quantity) AS totalQuantity, SUM(orderdetail.quantity*orderdetail.price) AS totalPrice FROM orders INNER JOIN customer ON customer.custID=orders.custID INNER JOIN orderdetail ON orders.orderID=orderdetail.orderID WHERE orders.statusID<>0 GROUP BY orders.orderID, orderDate, shipDate, receiveDate, orders.custID, status, customer.firstName,customer.lastName, orders.statusID ORDER BY orders.orderID DESC`;
    const results = await query<any[]>(sql);
    res.json(results);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.post("/api/payment", async (req: Request, res: Response) => {
  const { custID, orderID, price } = req.body;
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (custID != String(decode.custID)) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const slipFile = getUploadedFile(req, "slipFile");
    let fileName = "";
    if (slipFile) {
      const fileNameParts = slipFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/payment", fileName);
      await fs.promises.writeFile(imagePath, slipFile.data);
    }

    await query("INSERT INTO payment(orderID, price, slipFile) VALUES (?, ?, ?)", [orderID, price, fileName]);
    await query("UPDATE orders SET statusID = 2 WHERE orderID = ?", [orderID]);
    res.send({ message: "success", status: true });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/payment/image/:filename", (req: Request, res: Response) => {
  const filepath = path.join(__dirname, "../assets/payment", req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send({ message: "Image not found", status: false });
  }
  res.sendFile(filepath);
});

app.get("/api/province", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM province ORDER BY provinceName ASC");
    res.send(result);
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/position", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM position ORDER BY positionID ASC");
    res.send(result);
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/district/:provinceID", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM district WHERE provinceID = ? ORDER BY districtName ASC", [req.params.provinceID]);
    res.send(result);
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/subdistrict/:districtID", async (req: Request, res: Response) => {
  try {
    const result = await query<any[]>("SELECT * FROM subdistrict WHERE districtID = ? ORDER BY subdistrictName ASC", [req.params.districtID]);
    res.send(result);
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.get("/api/admin/overview", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const [customerResult] = await query<any[]>("SELECT COUNT(*) AS customerCount FROM customer");
    const [employeeResult] = await query<any[]>("SELECT COUNT(*) AS employeeCount FROM employee");
    const [typeResult] = await query<any[]>("SELECT COUNT(*) AS typeCount FROM producttype");
    const [productResult] = await query<any[]>("SELECT COUNT(*) AS productCount FROM product");

    res.send({
      customerCount: customerResult?.customerCount ?? 0,
      employeeCount: employeeResult?.employeeCount ?? 0,
      typeCount: typeResult?.typeCount ?? 0,
      productCount: productResult?.productCount ?? 0,
      status: true,
    });
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/reports/sales/year/:id", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    const custID = Number(req.params.id);
    if (decode.custID !== custID) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT YEAR(o.orderDate) AS year, SUM(od.quantity * od.price) AS totalSales
      FROM orders o
      INNER JOIN orderdetail od ON o.orderID = od.orderID
      WHERE o.statusID <> 0 AND o.orderDate IS NOT NULL AND o.custID = ?
      GROUP BY YEAR(o.orderDate)
      ORDER BY YEAR(o.orderDate) DESC`;
    const result = await query<any[]>(sql, [custID]);
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/reports/sales/year", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const sql = `SELECT YEAR(o.orderDate) AS year, SUM(od.quantity * od.price) AS totalSales
      FROM orders o
      INNER JOIN orderdetail od ON o.orderID = od.orderID
      WHERE o.statusID <> 0 AND o.orderDate IS NOT NULL
      GROUP BY YEAR(o.orderDate)
      ORDER BY YEAR(o.orderDate) DESC`;
    const result = await query<any[]>(sql);
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/reports/sales/month", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const year = req.query.year ? String(req.query.year) : new Date().getFullYear().toString();
    const sql = `SELECT MONTH(o.orderDate) AS month, SUM(od.quantity * od.price) AS totalSales
      FROM orders o
      INNER JOIN orderdetail od ON o.orderID = od.orderID
      WHERE o.statusID <> 0 AND o.orderDate IS NOT NULL AND YEAR(o.orderDate) = ?
      GROUP BY MONTH(o.orderDate)
      ORDER BY MONTH(o.orderDate)`;
    const result = await query<any[]>(sql, [year]);
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

app.get("/api/reports/products/top", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const limit = Number(req.query.limit ?? 5);
    const sql = `SELECT p.productID, p.productName, SUM(od.quantity * od.price) AS revenue
      FROM orderdetail od
      INNER JOIN product p ON p.productID = od.productID
      INNER JOIN orders o ON o.orderID = od.orderID
      WHERE o.statusID <> 0
      GROUP BY p.productID, p.productName
      ORDER BY revenue DESC
      LIMIT ?`;
    const result = await query<any[]>(sql, [limit]);
    res.send(result);
  } catch {
    res.status(401).send({ message: "โทเคนไม่ถูกต้อง", status: false });
  }
});

// --- Admin-specific Customer Registration ---
app.post("/api/customer", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const { username, password, firstName, lastName, address, subdistrictID, mobilePhone, homePhone, birthdate, gender, email } = req.body;
    const existingUser = await query<any[]>("SELECT * FROM customer WHERE username=?", [username]);
    if (existingUser.length > 0) {
      return res.send({ message: "ชื่อผู้ใช้ซ้ำ", status: false });
    }

    const imageFile = getUploadedFile(req, "imageFile");
    let fileName = "";
    if (imageFile) {
      const fileNameParts = imageFile.name.split(".");
      fileName = `${fileNameParts[0]}${Date.now()}.${fileNameParts[1]}`;
      const imagePath = path.join(__dirname, "../assets/customer", fileName);
      await fs.promises.writeFile(imagePath, imageFile.data);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password || "1234", salt);

    await query(
      `INSERT INTO customer (username, password, firstName, lastName, address, subdistrictID, mobilePhone, homePhone, birthdate, gender, email, imageFile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        password_hash,
        firstName,
        lastName,
        address || null,
        (subdistrictID && subdistrictID !== "-1") ? subdistrictID : null,
        mobilePhone || null,
        homePhone || null,
        (birthdate && birthdate !== "") ? birthdate : null,
        (gender !== undefined && gender !== "-1") ? Number(gender) : null,
        email || null,
        fileName || null
      ]
    );

    res.send({ message: "เพิ่มข้อมูลลูกค้าเรียบร้อยแล้ว", status: true });
  } catch (err) {
    res.status(500).send({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", status: false });
  }
});

// --- Position CRUD ---
app.post("/api/position", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }

    const { positionName } = req.body;
    await query("INSERT INTO `position` (`positionName`) VALUES (?)", [positionName]);
    res.send({ message: "เพิ่มข้อมูลตำแหน่งเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.put("/api/position/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { positionName } = req.body;
    await query("UPDATE position SET positionName = ? WHERE positionID = ?", [positionName, req.params.id]);
    res.send({ message: "แก้ไขข้อมูลตำแหน่งเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.delete("/api/position/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    await query("DELETE FROM position WHERE positionID = ?", [req.params.id]);
    res.send({ message: "ลบข้อมูลตำแหน่งเรียบร้อยแล้ว", status: true });
  } catch (err: any) {
    res.status(400).send({ message: err.message || "ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่", status: false });
  }
});

// --- Province CRUD ---
app.post("/api/province", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { provinceID, provinceName } = req.body;
    await query("INSERT INTO province (provinceID, provinceName) VALUES (?, ?)", [provinceID, provinceName]);
    res.send({ message: "เพิ่มข้อมูลจังหวัดเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.put("/api/province/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { provinceName } = req.body;
    await query("UPDATE province SET provinceName = ? WHERE provinceID = ?", [provinceName, req.params.id]);
    res.send({ message: "แก้ไขข้อมูลจังหวัดเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.delete("/api/province/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    await query("DELETE FROM province WHERE provinceID = ?", [req.params.id]);
    res.send({ message: "ลบข้อมูลจังหวัดเรียบร้อยแล้ว", status: true });
  } catch (err: any) {
    res.status(400).send({ message: err.message || "ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่", status: false });
  }
});

// --- District CRUD ---
app.post("/api/district", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { districtID, provinceID, districtName } = req.body;
    await query("INSERT INTO district (districtID, provinceID, districtName) VALUES (?, ?, ?)", [districtID, provinceID, districtName]);
    res.send({ message: "เพิ่มข้อมูลอำเภอเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.put("/api/district/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { provinceID, districtName } = req.body;
    await query("UPDATE district SET provinceID = ?, districtName = ? WHERE districtID = ?", [provinceID, districtName, req.params.id]);
    res.send({ message: "แก้ไขข้อมูลอำเภอเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.delete("/api/district/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    await query("DELETE FROM district WHERE districtID = ?", [req.params.id]);
    res.send({ message: "ลบข้อมูลอำเภอเรียบร้อยแล้ว", status: true });
  } catch (err: any) {
    res.status(400).send({ message: err.message || "ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่", status: false });
  }
});

// --- Subdistrict CRUD ---
app.post("/api/subdistrict", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { subdistrictID, districtID, subdistrictName } = req.body;
    await query("INSERT INTO subdistrict (subdistrictID, districtID, subdistrictName) VALUES (?, ?, ?)", [subdistrictID, districtID, subdistrictName]);
    res.send({ message: "เพิ่มข้อมูลตำบลเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.put("/api/subdistrict/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    const { districtID, subdistrictName } = req.body;
    await query("UPDATE subdistrict SET districtID = ?, subdistrictName = ? WHERE subdistrictID = ?", [districtID, subdistrictName, req.params.id]);
    res.send({ message: "แก้ไขข้อมูลตำบลเรียบร้อยแล้ว", status: true });
  } catch {
    res.status(500).send({ message: "Server error", status: false });
  }
});

app.delete("/api/subdistrict/:id", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") ?? "";
  try {
    const decode = verifyToken(token);
    if (decode.positionID !== 1 && decode.positionID !== 2) {
      return res.status(403).send({ message: "คุณไม่ได้รับสิทธิ์ในการเข้าใช้งาน", status: false });
    }
    await query("DELETE FROM subdistrict WHERE subdistrictID = ?", [req.params.id]);
    res.send({ message: "ลบข้อมูลตำบลเรียบร้อยแล้ว", status: true });
  } catch (err: any) {
    res.status(400).send({ message: err.message || "ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่", status: false });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(HOST_PORT, () => {
    console.log(`Server is running on port ${HOST_PORT}`);
  });
}

export default app;
