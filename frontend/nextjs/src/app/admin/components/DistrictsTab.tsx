/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { getProvinces, getDistricts, createDistrict, updateDistrict, deleteDistrict } from "@/lib/api";

interface DistrictsTabProps {
  token: string;
}

export default function DistrictsTab({ token }: DistrictsTabProps) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialog States
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [districtID, setDistrictID] = useState("");
  const [provinceID, setProvinceID] = useState("");
  const [districtName, setDistrictName] = useState("");

  const loadProvinces = async () => {
    try {
      const data = await getProvinces();
      setProvinces(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDistricts = async (provID: string) => {
    if (!provID) {
      setDistricts([]);
      return;
    }
    try {
      setLoading(true);
      const data = await getDistricts(provID);
      setDistricts(data);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถโหลดข้อมูลอำเภอได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  useEffect(() => {
    loadDistricts(selectedProvinceId);
  }, [selectedProvinceId]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setDistrictID("");
    setProvinceID(selectedProvinceId);
    setDistrictName("");
    setIsOpen(true);
  };

  const handleOpenEdit = (dist: any) => {
    setIsEdit(true);
    setDistrictID(dist.districtID);
    setProvinceID(dist.provinceID);
    setDistrictName(dist.districtName || "");
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`คุณต้องการลบอำเภอ รหัส ${id} หรือไม่?`)) return;
    try {
      const res = await deleteDistrict(id, token);
      if (res.status) {
        alert(res.message);
        loadDistricts(selectedProvinceId);
      } else {
        alert(res.message || "ลบไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถลบได้เนื่องจากมีข้อมูลตำบลผูกอยู่กับอำเภอนี้");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtID || !provinceID || !districtName) return;
    if (!isEdit && (districtID.length !== 4 || isNaN(Number(districtID)))) {
      alert("รหัสอำเภอต้องเป็นตัวเลข 4 หลัก (เช่น 1001)");
      return;
    }

    try {
      let res;
      if (isEdit) {
        res = await updateDistrict(districtID, { provinceID, districtName }, token);
      } else {
        res = await createDistrict({ districtID, provinceID, districtName }, token);
      }
      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        // Refresh local view if the current filter matches the edited province
        if (provinceID === selectedProvinceId) {
          loadDistricts(selectedProvinceId);
        } else {
          setSelectedProvinceId(provinceID);
        }
      } else {
        alert(res.message || "บันทึกผิดพลาด");
      }
    } catch (err: any) {
      alert(err.message || "บันทึกผิดพลาด");
    }
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm space-y-6 max-w-2xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-sans">ข้อมูลอำเภอ (Districts)</h2>
          <p className="text-slate-500 text-sm">จัดการข้อมูลอำเภอ/เขตในแต่ละจังหวัด</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> เพิ่มอำเภอ
        </button>
      </div>

      <div className="max-w-xs">
        <label htmlFor="province-filter-tab" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เลือกจังหวัด</label>
        <select
          id="province-filter-tab"
          value={selectedProvinceId}
          onChange={(e) => setSelectedProvinceId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer"
        >
          <option value="">-- เลือกจังหวัด --</option>
          {provinces.map((prov) => (
            <option key={prov.provinceID} value={prov.provinceID}>{prov.provinceName}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white max-h-[350px] overflow-y-auto pr-1">
        {!selectedProvinceId ? (
          <div className="p-8 text-center text-slate-500 text-sm">กรุณาเลือกจังหวัดเพื่อดูรายชื่ออำเภอ</div>
        ) : loading ? (
          <div className="text-center py-6 text-slate-500 text-sm">กำลังโหลด...</div>
        ) : districts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">ไม่พบข้อมูลอำเภอ</div>
        ) : (
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-6 py-4">รหัสอำเภอ</th>
                <th className="px-6 py-4">ชื่ออำเภอ</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {districts.map((d) => (
                <tr key={d.districtID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-mono font-semibold text-slate-900">#{d.districtID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{d.districtName}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(d)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(d.districtID)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 cursor-pointer transition"
                    >
                      <Trash2 className="h-3 w-3" /> ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 font-sans">
                {isEdit ? "แก้ไขข้อมูลอำเภอ" : "เพิ่มอำเภอใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">จังหวัด *</label>
                <select
                  value={provinceID}
                  onChange={(e) => setProvinceID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer font-sans"
                >
                  <option value="">-- เลือกจังหวัด --</option>
                  {provinces.map((prov) => (
                    <option key={prov.provinceID} value={prov.provinceID}>{prov.provinceName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">รหัสอำเภอ (ตัวเลข 4 หลัก) *</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  disabled={isEdit}
                  value={districtID}
                  onChange={(e) => setDistrictID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  placeholder="เช่น 1001"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่ออำเภอ *</label>
                <input
                  type="text"
                  required
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="เช่น เขตพระนคร, อำเภอบางพลี"
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
