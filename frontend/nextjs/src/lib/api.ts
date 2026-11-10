/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  AdminOverview,
  CartProduct,
  CartSummary,
  Customer,
  CustomerProfile,
  Employee,
  OrderDetail,
  OrderInfo,
  OrderSummary,
  Product,
  ProductType,
  Province,
  SaleByPeriod,
  TopProduct,
  UserSession,
} from "./types";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// In the browser, go through the public URL (nginx). On the Next.js server (inside the
// container) "localhost" is the container itself, so use the internal API_BASE_URL instead.
const getApiBase = () =>
  typeof window === "undefined" ? process.env.API_BASE_URL || PUBLIC_API_BASE : PUBLIC_API_BASE;

async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || (data && typeof data === "object" && data.status === false)) {
    throw new Error(data?.message || "API request failed");
  }

  return data as T;
}

export async function getProducts() {
  return apiFetch<Product[]>("/product");
}

export async function getProduct(productID: string) {
  return apiFetch<Product>(`/product/${productID}`);
}

export async function loginCustomer(username: string, password: string) {
  return apiFetch<UserSession>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function loginAdmin(username: string, password: string) {
  return apiFetch<UserSession>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function registerCustomer(data: any) {
  return apiFetch<{ message: string; status: boolean }>("/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile(custID: number, token: string) {
  return apiFetch<CustomerProfile>(`/profile/${custID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadCustomerImage(custID: number, imageFile: File, token: string) {
  const formData = new FormData();
  formData.append("imageFile", imageFile);

  return apiFetch<{ message: string; status: boolean }>(`/customer/image/upload/${custID}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export async function addToCart(custID: number, productID: number, quantity: number, price: number, token: string) {
  return apiFetch<{ message: string }>("/makeorder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ custID, productID, quantity, price }),
  });
}

export async function getCart(custID: number, token: string) {
  return apiFetch<CartSummary[]>(`/cart/${custID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCartProducts(custID: number, token: string) {
  return apiFetch<CartProduct[]>(`/cart/product/${custID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateCartProduct(custID: number, productID: number, quantity: number, token: string) {
  return apiFetch<{ message: string }>(`/cart/product/${custID}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productID, quantity }),
  });
}

export async function removeCartProduct(custID: number, orderID: number, productID: number, token: string) {
  return apiFetch<{ message: string }>(`/cart/product/${custID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderID, productID }),
  });
}

export async function confirmOrder(custID: number, orderID: number, token: string) {
  return apiFetch<{ message: string }>("/confirmorder", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ custID, orderID }),
  });
}

/** Charge a credit card via Omise. paymentToken comes from Omise.js (tokn_...). The server computes the amount. */
export async function payWithCard(custID: number, orderID: number, paymentToken: string, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/confirmpayment", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ custID, orderID, paymentToken }),
  });
}

export async function getPopularProducts(limit = 10) {
  return apiFetch<Product[]>(`/product/popular?limit=${limit}`);
}

export function productImageUrl(imageFile?: string | null) {
  if (!imageFile) return "";
  return `${PUBLIC_API_BASE}/product/image/${encodeURIComponent(imageFile)}`;
}

export async function getHistory(custID: number, token: string, year?: string) {
  const query = year ? `?year=${encodeURIComponent(year)}` : "";
  return apiFetch<OrderSummary[]>(`/history/${custID}${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getOrderInfo(custID: number, orderID: number, token: string) {
  return apiFetch<OrderInfo[]>(`/orderinfo/${custID}/${orderID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getOrderDetails(custID: number, orderID: number, token: string) {
  return apiFetch<OrderDetail[]>(`/orderdetail/${custID}/${orderID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function submitPayment(custID: number, orderID: number, price: number, slipFile: File, token: string) {
  const formData = new FormData();
  formData.append("custID", custID.toString());
  formData.append("orderID", orderID.toString());
  formData.append("price", price.toString());
  formData.append("slipFile", slipFile);

  return apiFetch<{ message: string }>("/payment", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export async function getAdminOverview(token: string) {
  return apiFetch<AdminOverview>("/admin/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSalesByYear(token: string) {
  return apiFetch<SaleByPeriod[]>("/reports/sales/year", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSalesByMonth(token: string, year: string) {
  return apiFetch<SaleByPeriod[]>(`/reports/sales/month?year=${encodeURIComponent(year)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTopProducts(token: string, limit = 5) {
  return apiFetch<TopProduct[]>(`/reports/products/top?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCustomers(token: string) {
  return apiFetch<Customer[]>("/customer", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getEmployees(token: string) {
  return apiFetch<Employee[]>("/employee", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getProductTypes() {
  return apiFetch<ProductType[]>("/producttype");
}

export async function getProvinces() {
  return apiFetch<Province[]>("/province");
}

export async function getPositions() {
  return apiFetch<any[]>("/position");
}

export async function getDistricts(provinceID: string) {
  return apiFetch<any[]>(`/district/${encodeURIComponent(provinceID)}`);
}

export async function getSubdistricts(districtID: string) {
  return apiFetch<any[]>(`/subdistrict/${encodeURIComponent(districtID)}`);
}

export async function updateCustomerProfile(custID: number, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/customer/${custID}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function getAdminOrder(orderID: number, token: string) {
  return apiFetch<OrderInfo[]>(`/orderinfo/${orderID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getOrderStatuses(token: string) {
  return apiFetch<any[]>("/admin/order/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateOrderStatus(orderID: number, statusID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/admin/order/status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderID, statusID }),
  });
}

export async function getAdminHistory(token: string) {
  return apiFetch<any[]>("/admin/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createCustomer(data: any, token: string) {
  const isFormData = data instanceof FormData;
  return apiFetch<{ message: string; status: boolean }>("/customer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function updateCustomer(custID: number, data: any, token: string) {
  const isFormData = data instanceof FormData;
  return apiFetch<{ message: string; status: boolean }>(`/customer/${custID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function deleteCustomer(custID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/customer/${custID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createEmployee(data: any, token: string) {
  const isFormData = data instanceof FormData;
  return apiFetch<{ message: string; status: boolean; tempPassword?: string }>("/employee", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function updateEmployee(empID: number, data: any, token: string) {
  const isFormData = data instanceof FormData;
  return apiFetch<{ message: string; status: boolean }>(`/employee/${empID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function deleteEmployee(empID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/employee/${empID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProduct(data: FormData, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/product", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: data,
  });
}

export async function updateProduct(productID: number, data: FormData, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/product/${productID}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: data,
  });
}

export async function deleteProduct(productID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/product/${productID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProductType(data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/producttype", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateProductType(typeID: number, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/producttype/${typeID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deleteProductType(typeID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/producttype/${typeID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createPosition(data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/position", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updatePosition(positionID: number, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/position/${positionID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deletePosition(positionID: number, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/position/${positionID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProvince(data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/province", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateProvince(provinceID: string, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/province/${encodeURIComponent(provinceID)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deleteProvince(provinceID: string, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/province/${encodeURIComponent(provinceID)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createDistrict(data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/district", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateDistrict(districtID: string, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/district/${encodeURIComponent(districtID)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deleteDistrict(districtID: string, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/district/${encodeURIComponent(districtID)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createSubdistrict(data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>("/subdistrict", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateSubdistrict(subdistrictID: string, data: any, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/subdistrict/${encodeURIComponent(subdistrictID)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function deleteSubdistrict(subdistrictID: string, token: string) {
  return apiFetch<{ message: string; status: boolean }>(`/subdistrict/${encodeURIComponent(subdistrictID)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
