/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import {
  getAdminOverview,
  getSalesByMonth,
  getSalesByYear,
  getTopProducts,
  getAdminHistory,
  getAdminOrder,
  updateOrderStatus,
} from "@/lib/api";
import type { AdminOverview, SaleByPeriod, TopProduct } from "@/lib/types";
import {
  Eye,
  CheckCircle,
  XCircle,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  Package,
  List,
  MapPin,
  Navigation,
} from "lucide-react";

// Import isolated tab components
import DashboardTab from "./components/DashboardTab";
import OrdersTab from "./components/OrdersTab";
import CustomersTab from "./components/CustomersTab";
import EmployeesTab from "./components/EmployeesTab";
import ProductsTab from "./components/ProductsTab";
import ProductTypesTab from "./components/ProductTypesTab";
import PositionsTab from "./components/PositionsTab";
import ProvincesTab from "./components/ProvincesTab";
import DistrictsTab from "./components/DistrictsTab";
import SubdistrictsTab from "./components/SubdistrictsTab";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function AdminPage() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [token, setToken] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  // Shared Dashboard stats states
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [salesYear, setSalesYear] = useState<SaleByPeriod[]>([]);
  const [salesMonth, setSalesMonth] = useState<SaleByPeriod[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Shared Orders list state
  const [allOrders, setAllOrders] = useState<any[]>([]);

  // Order Details Modal states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchDashboardData = async (authToken: string) => {
    try {
      const [overviewData, yearData, monthData, topData, historyData] = await Promise.all([
        getAdminOverview(authToken),
        getSalesByYear(authToken),
        getSalesByMonth(authToken, new Date().getFullYear().toString()),
        getTopProducts(authToken, 5),
        getAdminHistory(authToken),
      ]);

      setOverview(overviewData);
      setSalesYear(yearData);
      setSalesMonth(monthData);
      setTopProducts(topData);
      
      const pending = historyData.filter((order: any) => order.statusID === 2);
      setPendingOrders(pending);
      setAllOrders(historyData);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "เกิดข้อผิดพลาดในการโหลดข้อมูลแดชบอร์ด");
    }
  };

  const openOrderVerification = async (orderID: number) => {
    if (!token) return;
    try {
      setMessage(null);
      const orderInfo = await getAdminOrder(orderID, token);
      if (orderInfo && orderInfo.length > 0) {
        setSelectedOrder(orderInfo[0]);
        setModalOpen(true);
      } else {
        setMessage("ไม่พบข้อมูลคำสั่งซื้อ");
      }
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "ไม่สามารถดึงข้อมูลคำสั่งซื้อได้");
    }
  };

  const handleUpdateStatus = async (statusID: number) => {
    if (!selectedOrder || !token) return;
    try {
      setUpdatingStatus(true);
      await updateOrderStatus(selectedOrder.orderID, statusID, token);
      setModalOpen(false);
      setSelectedOrder(null);
      
      // Refresh order states
      await fetchDashboardData(token);
    } catch (error: unknown) {
      alert(getErrorMessage(error) || "เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    const authToken = localStorage.getItem("shopdee_token") || "";
    setToken(authToken);
    if (!authToken) {
      setMessage("กรุณาเข้าสู่ระบบด้วยบัญชีพนักงาน");
      return;
    }
    fetchDashboardData(authToken);
  }, []);

  const menuItems = [
    { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { id: "orders", label: "รายการสั่งซื้อ", icon: FileText },
    { id: "customers", label: "ข้อมูลลูกค้า", icon: Users },
    { id: "employees", label: "ข้อมูลพนักงาน", icon: UserCheck },
    { id: "products", label: "ข้อมูลสินค้า", icon: Package },
  ];

  const basicDataMenuItems = [
    { id: "types", label: "ประเภทสินค้า", icon: List },
    { id: "positions", label: "ตำแหน่ง", icon: UserCheck },
    { id: "provinces", label: "จังหวัด", icon: MapPin },
    { id: "districts", label: "อำเภอ", icon: MapPin },
    { id: "subdistricts", label: "ตำบล", icon: Navigation },
  ];

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
            <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">ไม่สามารถเข้าถึงแผงควบคุมได้</h2>
            <p className="text-slate-600 text-sm">{message || "กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานก่อนดำเนินการต่อ"}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />
      
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition"
          aria-label="Toggle Menu"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <span className="font-semibold text-slate-900">แผงควบคุมระบบแอดมิน</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-row relative min-h-0">
        {/* Mobile Drawer Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Sidebar Container (Responsive) */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between transition-transform duration-300 transform
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            md:block ${sidebarOpen ? "block" : "hidden md:flex"}
          `}
        >
          <div className="p-6 overflow-y-auto flex-1 space-y-7">
            {/* Main Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">เมนูหลัก</p>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        active
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Basic Data Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">ข้อมูลพื้นฐาน</p>
              <nav className="space-y-1">
                {basicDataMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        active
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {message && (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 px-6 py-4 text-sm text-rose-700 flex justify-between items-center">
                <span>{message}</span>
                <button onClick={() => setMessage(null)} className="font-semibold text-rose-800 hover:underline">ปิด</button>
              </div>
            )}

            {/* Render dynamic modular components based on active tab state */}
            {currentTab === "dashboard" && (
              <DashboardTab
                overview={overview}
                salesYear={salesYear}
                salesMonth={salesMonth}
                topProducts={topProducts}
                pendingOrders={pendingOrders}
                onVerifyOrder={openOrderVerification}
              />
            )}

            {currentTab === "orders" && (
              <OrdersTab
                allOrders={allOrders}
                token={token}
                onVerifyOrder={openOrderVerification}
                onOrderUpdated={() => fetchDashboardData(token)}
              />
            )}

            {currentTab === "customers" && (
              <CustomersTab token={token} />
            )}

            {currentTab === "employees" && (
              <EmployeesTab token={token} />
            )}

            {currentTab === "products" && (
              <ProductsTab token={token} />
            )}

            {currentTab === "types" && (
              <ProductTypesTab token={token} />
            )}

            {currentTab === "positions" && (
              <PositionsTab token={token} />
            )}

            {currentTab === "provinces" && (
              <ProvincesTab token={token} />
            )}

            {currentTab === "districts" && (
              <DistrictsTab token={token} />
            )}

            {currentTab === "subdistricts" && (
              <SubdistrictsTab token={token} />
            )}
          </div>
        </main>
      </div>

      {/* Shared Verification / Detail Modal */}
      {modalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">รายละเอียดคำสั่งซื้อ #{selectedOrder.orderID}</h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {/* Customer Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">ข้อมูลลูกค้า</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.firstName} {selectedOrder.lastName}</p>
                  <p className="text-slate-600">{selectedOrder.mobilePhone}</p>
                  <p className="text-slate-600">{selectedOrder.address}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">สรุปรายการ</p>
                  <p className="mt-1 text-slate-600">วันที่สั่งซื้อ: {selectedOrder.orderDate}</p>
                  <p className="text-lg font-bold text-slate-900 mt-2">ยอดชำระ: ฿{Number(selectedOrder.totalPrice).toFixed(2)}</p>
                  <p className="text-sm mt-1">
                    สถานะการจัดส่ง:{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedOrder.statusID === 1
                        ? "รอการชำระเงิน"
                        : selectedOrder.statusID === 2
                        ? "กำลังตรวจสอบการชำระ"
                        : selectedOrder.statusID === 3
                        ? "ชำระแล้ว"
                        : selectedOrder.statusID === 4
                        ? "กำลังส่งสินค้า"
                        : selectedOrder.statusID === 5
                        ? "ส่งสินค้าแล้ว"
                        : "ไม่ทราบสถานะ"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Payment Info & Slip Display */}
              <div className="border-t border-slate-100 pt-4">
                <p className="font-semibold text-slate-900 mb-2">ข้อมูลหลักฐานการโอนเงิน</p>
                {selectedOrder.channelID === 1 && selectedOrder.slipFile ? (
                  <div className="space-y-3">
                    <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-medium">
                      ชำระแบบโอนสลิป (Channel ID: 1)
                    </p>
                    <p className="text-xs text-slate-500">
                      สลิปล่าสุด{selectedOrder.paymentDate ? ` · ส่งเมื่อ ${selectedOrder.paymentDate}` : ""}
                      {Number(selectedOrder.slipCount) > 1 ? ` · (ลูกค้าส่งสลิปทั้งหมด ${selectedOrder.slipCount} ครั้ง)` : ""}
                    </p>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-w-sm bg-slate-100 shadow-sm mx-auto">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api"}/payment/image/${selectedOrder.slipFile}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group relative"
                        title="คลิกดูภาพใหญ่"
                      >
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api"}/payment/image/${selectedOrder.slipFile}`}
                          alt="Transfer Slip"
                          className="w-full max-h-80 object-contain transition group-hover:opacity-90"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition text-white text-xs font-semibold">
                          คลิกเพื่อดูรูปภาพขนาดเต็ม
                        </div>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 bg-slate-50 p-4 rounded-xl">
                    ไม่พบหลักฐานการโอนสลิป (ลูกค้าอาจชำระผ่านช่องทางอื่น เช่น บัตรเครดิต หรือ ยังไม่ได้ส่งสลิป)
                  </p>
                )}
              </div>

              {/* Products list inside order */}
              <div className="border-t border-slate-100 pt-4">
                <p className="font-semibold text-slate-900 mb-3">รายการสินค้า</p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-slate-700">
                  {selectedOrder.orderDetails?.map((item: any) => (
                    <div key={item.productID} className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl">
                      <div>
                        <span className="font-semibold text-slate-900">{item.productName}</span>
                        <span className="text-slate-500 ml-2">x{item.quantity}</span>
                      </div>
                      <span className="font-semibold text-slate-900">฿{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons (only show if status is pending check: statusID = 2) */}
              {selectedOrder.statusID === 2 ? (
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => handleUpdateStatus(3)}
                    disabled={updatingStatus}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" /> อนุมัติยอดเงิน (ชำระแล้ว)
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(1)}
                    disabled={updatingStatus}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> ปฏิเสธ (รอการชำระเงินใหม่)
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end border-t border-slate-100 pt-4">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setSelectedOrder(null);
                    }}
                    className="rounded-full bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-800 font-semibold text-xs px-5 py-2.5 cursor-pointer transition shadow-xs"
                  >
                    ปิด
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
