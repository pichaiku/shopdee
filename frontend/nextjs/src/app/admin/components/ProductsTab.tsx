/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Upload, X } from "lucide-react";
import { getProducts, getProductTypes, createProduct, updateProduct, deleteProduct } from "@/lib/api";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
interface ProductsTabProps {
  token: string;
}

export default function ProductsTab({ token }: ProductsTabProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedProductID, setSelectedProductID] = useState<number | null>(null);

  // Form states
  const [productName, setProductName] = useState("");
  const [productDetail, setProductDetail] = useState("");
  const [cost, setCost] = useState("0");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("0");
  const [typeID, setTypeID] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const loadTypes = async () => {
      try {
        const types = await getProductTypes();
        setProductTypes(types);
        if (types.length > 0) {
          setTypeID(String(types[0].typeID));
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadTypes();
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSelectedProductID(null);
    setProductName("");
    setProductDetail("");
    setCost("0");
    setPrice("0");
    setQuantity("0");
    if (productTypes.length > 0) {
      setTypeID(String(productTypes[0].typeID));
    }
    setImageFile(null);
    setImagePreview(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (prod: any) => {
    setIsEdit(true);
    setSelectedProductID(prod.productID);
    setProductName(prod.productName || "");
    setProductDetail(prod.productDetail || "");
    setCost(String(prod.cost || 0));
    setPrice(String(prod.price || 0));
    setQuantity(String(prod.stock !== undefined ? prod.stock : prod.quantity || 0));
    setTypeID(prod.typeID ? String(prod.typeID) : "");
    setImageFile(null);
    setImagePreview(prod.imageFile ? `${PUBLIC_API_BASE}/product/image/${prod.imageFile}` : null);
    setIsOpen(true);
  };

  const handleDelete = async (productID: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสินค้านี้?")) return;
    try {
      const res = await deleteProduct(productID, token);
      if (res.status) {
        alert(res.message);
        loadProducts();
      } else {
        alert(res.message || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !cost || !price || !quantity || !typeID) {
      alert("กรุณากรอกข้อมูลในฟิลด์ที่จำเป็นทั้งหมด");
      return;
    }
    if (!isEdit && !imageFile) {
      alert("กรุณาอัปโหลดรูปภาพสินค้า");
      return;
    }

    const formData = new FormData();
    formData.append("productName", productName);
    formData.append("productDetail", productDetail);
    formData.append("cost", cost);
    formData.append("price", price);
    formData.append("quantity", quantity);
    formData.append("typeID", typeID);
    if (imageFile) {
      formData.append("imageFile", imageFile);
    }

    try {
      let res;
      if (isEdit && selectedProductID) {
        res = await updateProduct(selectedProductID, formData, token);
      } else {
        res = await createProduct(formData, token);
      }

      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        loadProducts();
      } else {
        alert(res.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ข้อมูลสินค้า</h2>
          <p className="text-slate-500 text-sm">รายการสินค้าคงคลังทั้งหมด สามารถเพิ่ม แก้ไขราคา ต้นทุน หรือสต็อกสินค้าได้</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มสินค้าใหม่
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">รูปภาพ</th>
                <th className="px-6 py-4">รหัสสินค้า</th>
                <th className="px-6 py-4">ชื่อสินค้า</th>
                <th className="px-6 py-4">หมวดหมู่</th>
                <th className="px-6 py-4 text-right">ราคาทุน</th>
                <th className="px-6 py-4 text-right">ราคาขาย</th>
                <th className="px-6 py-4 text-right">จำนวนคงเหลือ</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((prod) => (
                <tr key={prod.productID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                      {prod.imageFile ? (
                        <img
                          src={`${PUBLIC_API_BASE}/product/image/${prod.imageFile}`}
                          alt={prod.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No img</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">#{prod.productID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{prod.productName}</td>
                  <td className="px-6 py-4 text-slate-600">{prod.typeName || "-"}</td>
                  <td className="px-6 py-4 text-right text-slate-600 font-mono">฿{Number(prod.cost || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono">฿{Number(prod.price || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-slate-700 font-semibold">{prod.stock !== undefined ? prod.stock : prod.quantity} ชิ้น</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(prod.productID)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold text-xs px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 cursor-pointer transition"
                    >
                      <Trash2 className="h-3 w-3" /> ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900">
                {isEdit ? `แก้ไขสินค้า ID: #${selectedProductID}` : "เพิ่มสินค้าใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-6 text-sm">
              {/* Image Upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-32 w-32 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer transition">
                  <Upload className="h-3.5 w-3.5" /> อัปโหลดรูปภาพสินค้า *
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Names */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อสินค้า *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="ชื่อสินค้า"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">รายละเอียดสินค้า</label>
                <textarea
                  rows={3}
                  value={productDetail}
                  onChange={(e) => setProductDetail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="คำอธิบายเกี่ยวกับสินค้า"
                />
              </div>

              {/* Numbers grid */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ต้นทุน (Cost) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ราคาขาย (Price) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">จำนวนสินค้า (Stock) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition text-right"
                  />
                </div>
              </div>

              {/* Product category selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ประเภทสินค้า *</label>
                <select
                  value={typeID}
                  onChange={(e) => setTypeID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer"
                >
                  <option value="">-- เลือกประเภทสินค้า --</option>
                  {productTypes.map((t) => (
                    <option key={t.typeID} value={t.typeID}>{t.typeName}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-white hover:bg-slate-800 font-semibold cursor-pointer shadow-sm"
                >
                  บันทึกสินค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
