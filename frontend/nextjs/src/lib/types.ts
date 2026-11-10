export interface Product {
  productID: number;
  productName: string;
  productDetail?: string;
  price: number;
  cost?: number;
  quantity: number;
  imageFile: string;
  typeID?: number;
  typeName?: string;
  totalSold?: number;
}

export interface RecommendedProduct extends Product {
  /** "recommended" = from the ML service, "popular" = best-seller fallback */
  source: "recommended" | "popular";
}

export interface UserSession {
  type: "customer" | "admin";
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  token: string;
}

export interface CartSummary {
  orderID: number;
  orderDate?: string | null;
  shipDate?: string | null;
  receiveDate?: string | null;
  custID: number;
  statusID: number;
  firstName: string;
  lastName: string;
  address: string;
  mobilePhone: string;
  totalQuantity: number;
  totalPrice: number;
  itemCount: number;
}

export interface CartProduct {
  orderID: number;
  productID: number;
  quantity: number;
  price: number;
  productName: string;
  imageFile: string;
}

export interface OrderSummary {
  orderID: number;
  orderDate?: string | null;
  shipDate?: string | null;
  receiveDate?: string | null;
  statusID: number;
  statusName: string;
  totalQuantity: number;
  totalPrice: number;
  firstName: string;
  lastName: string;
}

export interface CustomerProfile {
  custID: number;
  username: string;
  firstName: string;
  lastName: string;
  address?: string;
  mobilePhone?: string;
  email?: string;
  gender?: number | null;
  birthdate?: string | null;
  imageFile?: string;
}

export interface Customer {
  custID: number;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  isActive?: number;
}

export interface Employee {
  empID: number;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  positionName?: string;
  isActive?: number;
}

export interface ProductType {
  typeID: number;
  typeName: string;
}

export interface Province {
  provinceID: string;
  provinceName: string;
}

export interface OrderDetail {
  orderID: number;
  productID: number;
  quantity: number;
  price: number;
  productName: string;
}

export interface OrderInfo {
  orderID: number;
  orderDate?: string | null;
  shipDate?: string | null;
  receiveDate?: string | null;
  custID: number;
  statusID: number;
  statusName: string;
  firstName: string;
  lastName: string;
  address: string;
  mobilePhone: string;
  totalQuantity: number;
  totalPrice: number;
  orderDetails?: OrderDetail[];
}

export interface AdminOverview {
  customerCount: number;
  employeeCount: number;
  typeCount: number;
  productCount: number;
}

export interface SaleByPeriod {
  year?: number;
  month?: number;
  totalSales: number;
}

export interface TopProduct {
  productID: number;
  productName: string;
  revenue: number;
}
