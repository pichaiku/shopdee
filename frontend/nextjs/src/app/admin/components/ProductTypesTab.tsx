/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { getProductTypes, createProductType, updateProductType, deleteProductType } from "@/lib/api";

interface ProductTypesTabProps {
  token: string;
}

export default function ProductTypesTab({ token }: ProductTypesTabProps) {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedTypeID, setSelectedTypeID] = useState<number | null>(null);
  const [typeName, setTypeName] = useState("");

  const loadTypes = async () => {
    try {
      setLoading(true);
      const data = await getProductTypes();
      setTypes(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลประเภทสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSelectedTypeID(null);
    setTypeName("");
    setIsOpen(true);
  };

  const handleOpenEdit = (type: any) => {
    setIsEdit(true);
    setSelectedTypeID(type.typeID);
    setTypeName(type.typeName || "");
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("คุณต้องการลบหมวดหมู่นี้หรือไม่?")) return;
    try {
      const res = await deleteProductType(id, token);
      if (res.status) {
        alert(res.message);
        loadTypes();
      } else {
        alert(res.message || "ลบไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเชื่อมต่อระบบได้");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeName) return;
    try {
      let res;
      if (isEdit && selectedTypeID) {
        res = await updateProductType(selectedTypeID, { typeName }, token);
      } else {
        res = await createProductType({ typeName }, token);
      }
      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        loadTypes();
      } else {
        alert(res.message || "บันทึกผิดพลาด");
      }
    } catch (err: any) {
      alert(err.message || "บันทึกผิดพลาด");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ประเภทสินค้า (Product Types)</h2>
          <p className="text-slate-500 text-sm">จัดการข้อมูลหมวดหมู่/ประเภทของสินค้าที่มีในร้านค้า</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มประเภท
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500">กำลังโหลด...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">รหัสประเภท</th>
                <th className="px-6 py-4">ชื่อประเภทสินค้า</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {types.map((t) => (
                <tr key={t.typeID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">#{t.typeID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{t.typeName}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(t.typeID)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 cursor-pointer transition"
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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? "แก้ไขประเภทสินค้า" : "เพิ่มประเภทสินค้าใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อประเภทสินค้า *</label>
                <input
                  type="text"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="เช่น เสื้อผ้า, อุปกรณ์กีฬา"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-5 py-2 text-white hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
