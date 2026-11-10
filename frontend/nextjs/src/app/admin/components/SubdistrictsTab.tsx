/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { getProvinces, getDistricts, getSubdistricts, createSubdistrict, updateSubdistrict, deleteSubdistrict } from "@/lib/api";

interface SubdistrictsTabProps {
  token: string;
}

export default function SubdistrictsTab({ token }: SubdistrictsTabProps) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [subdistricts, setSubdistricts] = useState<any[]>([]);
  
  // Outer filters
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialog States
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [subdistrictID, setSubdistrictID] = useState("");
  const [dialogProvinceID, setDialogProvinceID] = useState("");
  const [dialogDistrictID, setDialogDistrictID] = useState("");
  const [subdistrictName, setSubdistrictName] = useState("");

  // Dialog-specific list cascades
  const [dialogDistrictsList, setDialogDistrictsList] = useState<any[]>([]);

  const loadProvinces = async () => {
    try {
      const data = await getProvinces();
      setProvinces(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  // Filter Cascade
  useEffect(() => {
    if (!selectedProvinceId) {
      setDistricts([]);
      setSelectedDistrictId("");
      setSubdistricts([]);
      return;
    }
    const loadDists = async () => {
      try {
        const data = await getDistricts(selectedProvinceId);
        setDistricts(data);
        setSelectedDistrictId("");
        setSubdistricts([]);
      } catch (err) {
        console.error(err);
      }
    };
    loadDists();
  }, [selectedProvinceId]);

  useEffect(() => {
    if (!selectedDistrictId) {
      setSubdistricts([]);
      return;
    }
    const loadSubs = async () => {
      try {
        setLoading(true);
        const data = await getSubdistricts(selectedDistrictId);
        setSubdistricts(data);
      } catch (err: any) {
        alert(err.message || "ไม่สามารถโหลดข้อมูลตำบลได้");
      } finally {
        setLoading(false);
      }
    };
    loadSubs();
  }, [selectedDistrictId]);

  // Dialog Cascade
  useEffect(() => {
    if (!dialogProvinceID) {
      setDialogDistrictsList([]);
      setDialogDistrictID("");
      return;
    }
    const loadDialogDists = async () => {
      try {
        const data = await getDistricts(dialogProvinceID);
        setDialogDistrictsList(data);
      } catch (err) {
        console.error(err);
      }
    };
    loadDialogDists();
  }, [dialogProvinceID]);

  const handleOpenAdd = () => {
    setIsEdit(false);
    setSubdistrictID("");
    setDialogProvinceID(selectedProvinceId);
    setDialogDistrictID(selectedDistrictId);
    setSubdistrictName("");
    setIsOpen(true);
  };

  const handleOpenEdit = (sd: any) => {
    setIsEdit(true);
    setSubdistrictID(sd.subdistrictID);
    setSubdistrictName(sd.subdistrictName || "");
    // Extract province and district from subdistrict ID (e.g. 100101 -> province 10, district 1001)
    const provID = sd.subdistrictID.substring(0, 2);
    const distID = sd.subdistrictID.substring(0, 4);
    setDialogProvinceID(provID);
    setDialogDistrictID(distID);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`คุณต้องการลบตำบล รหัส ${id} หรือไม่?`)) return;
    try {
      const res = await deleteSubdistrict(id, token);
      if (res.status) {
        alert(res.message);
        if (selectedDistrictId) {
          const data = await getSubdistricts(selectedDistrictId);
          setSubdistricts(data);
        }
      } else {
        alert(res.message || "ลบไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "ไม่สามารถลบได้เนื่องจากมีการใช้งานอยู่ในที่อยู่จัดส่งของลูกค้า");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subdistrictID || !dialogDistrictID || !subdistrictName) return;
    if (!isEdit && (subdistrictID.length !== 6 || isNaN(Number(subdistrictID)))) {
      alert("รหัสตำบลต้องเป็นตัวเลข 6 หลัก (เช่น 100101)");
      return;
    }

    try {
      let res;
      if (isEdit) {
        res = await updateSubdistrict(subdistrictID, { districtID: dialogDistrictID, subdistrictName }, token);
      } else {
        res = await createSubdistrict({ subdistrictID, districtID: dialogDistrictID, subdistrictName }, token);
      }
      if (res.status) {
        alert(res.message);
        setIsOpen(false);
        // Refresh local view if the current filter matches
        if (dialogDistrictID === selectedDistrictId) {
          const data = await getSubdistricts(selectedDistrictId);
          setSubdistricts(data);
        } else {
          setSelectedProvinceId(dialogProvinceID);
          // Wait briefly for province cascade to trigger, then select district
          setTimeout(() => {
            setSelectedDistrictId(dialogDistrictID);
          }, 300);
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
          <h2 className="text-2xl font-bold text-slate-900 font-sans">ข้อมูลตำบล (Subdistricts)</h2>
          <p className="text-slate-500 text-sm">จัดการข้อมูลตำบลและรหัสจัดส่งย่อย</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> เพิ่มตำบล
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
        <div>
          <label htmlFor="province-select-sub-tab" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เลือกจังหวัด</label>
          <select
            id="province-select-sub-tab"
            value={selectedProvinceId}
            onChange={(e) => setSelectedProvinceId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer font-sans"
          >
            <option value="">-- เลือกจังหวัด --</option>
            {provinces.map((prov) => (
              <option key={prov.provinceID} value={prov.provinceID}>{prov.provinceName}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="district-select-sub-tab" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">เลือกอำเภอ</label>
          <select
            id="district-select-sub-tab"
            value={selectedDistrictId}
            onChange={(e) => setSelectedDistrictId(e.target.value)}
            disabled={!selectedProvinceId}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          >
            <option value="">-- เลือกอำเภอ --</option>
            {districts.map((d) => (
              <option key={d.districtID} value={d.districtID}>{d.districtName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white max-h-[350px] overflow-y-auto pr-1">
        {!selectedProvinceId || !selectedDistrictId ? (
          <div className="p-8 text-center text-slate-500 text-sm font-sans">กรุณาเลือกจังหวัดและอำเภอเพื่อดูรายชื่อตำบล</div>
        ) : loading ? (
          <div className="text-center py-6 text-slate-500 text-sm">กำลังโหลด...</div>
        ) : subdistricts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">ไม่พบข้อมูลตำบล</div>
        ) : (
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100 sticky top-0">
              <tr>
                <th className="px-6 py-4">รหัสตำบล</th>
                <th className="px-6 py-4">ชื่อตำบล</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {subdistricts.map((sd) => (
                <tr key={sd.subdistrictID} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-mono font-semibold text-slate-900">#{sd.subdistrictID}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{sd.subdistrictName}</td>
                  <td className="px-6 py-4 text-center space-x-2">
                    <button
                      onClick={() => handleOpenEdit(sd)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <Edit2 className="h-3 w-3" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(sd.subdistrictID)}
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
          <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 font-sans">
                {isEdit ? "แก้ไขข้อมูลตำบล" : "เพิ่มตำบลใหม่"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">จังหวัด *</label>
                <select
                  value={dialogProvinceID}
                  onChange={(e) => setDialogProvinceID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer font-sans"
                >
                  <option value="">-- เลือกจังหวัด --</option>
                  {provinces.map((prov) => (
                    <option key={prov.provinceID} value={prov.provinceID}>{prov.provinceName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">อำเภอ *</label>
                <select
                  value={dialogDistrictID}
                  onChange={(e) => setDialogDistrictID(e.target.value)}
                  disabled={!dialogProvinceID}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                >
                  <option value="">-- เลือกอำเภอ --</option>
                  {dialogDistrictsList.map((d) => (
                    <option key={d.districtID} value={d.districtID}>{d.districtName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">รหัสตำบล (ตัวเลข 6 หลัก) *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  disabled={isEdit}
                  value={subdistrictID}
                  onChange={(e) => setSubdistrictID(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  placeholder="เช่น 100101"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ชื่อตำบล *</label>
                <input
                  type="text"
                  required
                  value={subdistrictName}
                  onChange={(e) => setSubdistrictName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white transition"
                  placeholder="เช่น พระบรมมหาราชวัง"
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
