"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AuthLayout, { authInputClass } from "@/components/shop/AuthLayout";
import { registerCustomer } from "@/lib/api";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSuccess(false);
    setLoading(true);

    try {
      await registerCustomer({ username, password, firstName, lastName });
      setIsSuccess(true);
      setMessage("สมัครสมาชิกสำเร็จ! กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error) || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">สร้างบัญชีผู้ใช้งานใหม่</h1>
          <p className="text-slate-500">สมัครฟรี ใช้เวลาไม่ถึงนาที แล้วเริ่มช้อปได้ทันที</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="text-sm font-medium text-slate-700">ชื่อจริง</label>
              <input type="text" id="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={authInputClass} required />
            </div>
            <div>
              <label htmlFor="lastName" className="text-sm font-medium text-slate-700">นามสกุล</label>
              <input type="text" id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={authInputClass} required />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="text-sm font-medium text-slate-700">ชื่อผู้ใช้ (Username)</label>
            <input type="text" id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={authInputClass} required />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">รหัสผ่าน (Password)</label>
            <input type="password" id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInputClass} required />
          </div>

          {message ? (
            <p id="message-banner" role={isSuccess ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm font-medium ${isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            id="submit-register"
            disabled={loading || isSuccess}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            สมัครสมาชิก
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
