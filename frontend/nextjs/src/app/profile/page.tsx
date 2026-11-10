"use client";

import { useEffect, useState, useRef } from "react";
import ShopShell, { PageHeader } from "@/components/shop/ShopShell";
import { getProfile, uploadCustomerImage, updateCustomerProfile } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import { Camera, User, Loader2 } from "lucide-react";

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function ProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    mobilePhone: "",
    address: "",
    gender: -1,
    birthdate: "",
  });

  const fetchProfile = async () => {
    const token = localStorage.getItem("shopdee_token");
    const rawUser = localStorage.getItem("shopdee_user");
    if (!token || !rawUser) {
      setMessageType("error");
      setMessage("กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์");
      return;
    }
    try {
      const session = JSON.parse(rawUser);
      if (session.type !== "customer") {
        setMessageType("error");
        setMessage("หน้านี้ใช้งานได้สำหรับลูกค้าเท่านั้น");
        return;
      }
      const profileData = await getProfile(Number(session.id), token);
      setProfile(profileData);
      setEditForm({
        firstName: profileData.firstName || "",
        lastName: profileData.lastName || "",
        username: profileData.username || "",
        email: profileData.email || "",
        mobilePhone: profileData.mobilePhone || "",
        address: profileData.address || "",
        gender: profileData.gender !== null && profileData.gender !== undefined ? Number(profileData.gender) : -1,
        birthdate: profileData.birthdate || "",
      });
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(getErrorMessage(error) || "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้");
    }
  };

  const handleSave = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.username.trim()) {
      setMessageType("error");
      setMessage("กรุณากรอก ชื่อ, นามสกุล, และ ชื่อผู้ใช้");
      return;
    }

    const token = localStorage.getItem("shopdee_token");
    const rawUser = localStorage.getItem("shopdee_user");
    if (!token || !rawUser || !profile) {
      setMessageType("error");
      setMessage("ไม่สามารถบันทึกได้เนื่องจากข้อมูลเซสชันไม่ถูกต้อง");
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const session = JSON.parse(rawUser);

      const payload = {
        username: editForm.username,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email || null,
        gender: editForm.gender !== -1 ? editForm.gender : null,
        birthdate: editForm.birthdate || null,
        address: editForm.address || null,
        mobilePhone: editForm.mobilePhone || null,
        homePhone: null,
      };

      await updateCustomerProfile(Number(session.id), payload, token);

      setMessageType("success");
      setMessage("แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว");

      await fetchProfile();
      setIsEditing(false);
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(getErrorMessage(error) || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessageType("error");
      setMessage("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    const token = localStorage.getItem("shopdee_token");
    const rawUser = localStorage.getItem("shopdee_user");
    if (!token || !rawUser || !profile) {
      setMessageType("error");
      setMessage("ไม่สามารถอัปโหลดได้เนื่องจากข้อมูลเซสชันไม่ถูกต้อง");
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const session = JSON.parse(rawUser);
      await uploadCustomerImage(Number(session.id), file, token);

      setMessageType("success");
      setMessage("อัปโหลดไฟล์รูปภาพเรียบร้อยแล้ว");

      // Reload profile to get the updated image filename
      await fetchProfile();
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(getErrorMessage(error) || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <ShopShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader eyebrow="บัญชีของฉัน" title="ข้อมูลส่วนตัว" description="จัดการข้อมูลบัญชี ที่อยู่จัดส่ง และรูปโปรไฟล์ของคุณ" />

          {message ? (
            <div className={`rounded-2xl px-5 py-3 border text-sm font-medium ${messageType === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                : "bg-rose-50 text-rose-800 border-rose-100"
              }`}>
              {message}
            </div>
          ) : null}

          {profile ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28 bg-gradient-to-r from-brand-500 via-rose-500 to-fuchsia-500" />
              <div className="-mt-16 space-y-8 p-6 sm:p-8">
              {/* Profile Image & Quick Details Header */}
              <div className="flex flex-col items-center border-b border-slate-100 pb-8 sm:flex-row sm:items-start sm:gap-8">
                <div className="relative group">
                  <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md">
                    {profile.imageFile ? (
                      <img
                        src={`${PUBLIC_API_BASE}/customer/image/${profile.imageFile}`}
                        alt={`${profile.firstName} ${profile.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <User className="h-16 w-16" />
                      </div>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white backdrop-blur-xs">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={triggerFileInput}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                    title="เปลี่ยนรูปภาพโปรไฟล์"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="mt-6 text-center sm:mt-16 sm:text-left flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{profile.firstName} {profile.lastName}</h2>
                      <p className="text-slate-500">@{profile.username}</p>
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        ลูกค้าสมาชิก
                      </p>
                    </div>
                    <div>
                      {!isEditing ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition shadow-sm cursor-pointer"
                        >
                          แก้ไขข้อมูล
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={handleSave}
                            disabled={uploading}
                            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setMessage(null);
                              setEditForm({
                                firstName: profile.firstName || "",
                                lastName: profile.lastName || "",
                                username: profile.username || "",
                                email: profile.email || "",
                                mobilePhone: profile.mobilePhone || "",
                                address: profile.address || "",
                                gender: profile.gender !== null && profile.gender !== undefined ? Number(profile.gender) : -1,
                                birthdate: profile.birthdate || "",
                              });
                            }}
                            className="rounded-full bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!isEditing ? (
                // View Mode
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">ชื่อ - นามสกุล</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{profile.firstName} {profile.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">ชื่อผู้ใช้</p>
                      <p className="mt-2 text-slate-900">{profile.username}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">อีเมล</p>
                      <p className="mt-2 text-slate-900">{profile.email ?? "ไม่ระบุ"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">เพศ</p>
                      <p className="mt-2 text-slate-900">
                        {profile.gender === 0 ? "ชาย" : profile.gender === 1 ? "หญิง" : "ไม่ระบุ"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">โทรศัพท์</p>
                      <p className="mt-2 text-slate-900">{profile.mobilePhone ?? "ไม่ระบุ"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">ที่อยู่</p>
                      <p className="mt-2 text-slate-900">{profile.address ?? "ไม่ระบุ"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">วันเกิด</p>
                      <p className="mt-2 text-slate-900">{profile.birthdate ?? "ไม่ระบุ"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                // Edit Mode
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">ชื่อ</p>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                          required
                        />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">นามสกุล</p>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">ชื่อผู้ใช้</p>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                        required
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">อีเมล</p>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">เพศ</p>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm({ ...editForm, gender: Number(e.target.value) })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 bg-white"
                      >
                        <option value={-1}>ไม่ระบุ</option>
                        <option value={0}>ชาย</option>
                        <option value={1}>หญิง</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">โทรศัพท์</p>
                      <input
                        type="text"
                        value={editForm.mobilePhone}
                        onChange={(e) => setEditForm({ ...editForm, mobilePhone: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">ที่อยู่</p>
                      <textarea
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 min-h-[90px]"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">วันเกิด</p>
                      <input
                        type="date"
                        value={editForm.birthdate}
                        onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ShopShell>
  );
}
