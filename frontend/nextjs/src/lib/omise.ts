// Minimal Omise.js loader/wrapper. Card data goes straight from the browser to Omise;
// our server only ever receives the one-time token (tokn_...).
// Docs: https://docs.opn.ooo/omise-js

export interface OmiseCard {
  name: string;
  number: string;
  expiration_month: number;
  expiration_year: number;
  security_code: string;
}

interface OmiseTokenResponse {
  object: "token" | "error";
  id?: string;
  message?: string;
  code?: string;
}

interface OmiseJs {
  setPublicKey(key: string): void;
  createToken(type: "card", data: OmiseCard, callback: (statusCode: number, response: OmiseTokenResponse) => void): void;
}

declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

const OMISE_JS_URL = "https://cdn.omise.co/omise.js";
let loader: Promise<OmiseJs> | null = null;

export function loadOmise(): Promise<OmiseJs> {
  if (typeof window === "undefined") return Promise.reject(new Error("Omise.js can only run in the browser"));
  if (window.Omise) return Promise.resolve(window.Omise);
  if (loader) return loader;

  loader = new Promise<OmiseJs>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OMISE_JS_URL;
    script.async = true;
    script.onload = () => (window.Omise ? resolve(window.Omise) : reject(new Error("โหลด Omise.js ไม่สำเร็จ")));
    script.onerror = () => {
      loader = null;
      reject(new Error("ไม่สามารถเชื่อมต่อ Omise ได้ กรุณาตรวจสอบอินเทอร์เน็ต"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export async function createCardToken(card: OmiseCard): Promise<string> {
  const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;
  if (!publicKey) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_OMISE_PUBLIC_KEY");
  const omise = await loadOmise();
  omise.setPublicKey(publicKey);
  return new Promise((resolve, reject) => {
    omise.createToken("card", card, (statusCode, response) => {
      if (statusCode === 200 && response.object === "token" && response.id) resolve(response.id);
      else reject(new Error(translateOmiseError(response.message)));
    });
  });
}

function translateOmiseError(message?: string) {
  if (!message) return "ไม่สามารถตรวจสอบข้อมูลบัตรได้";
  const m = message.toLowerCase();
  if (m.includes("number")) return "หมายเลขบัตรไม่ถูกต้อง";
  if (m.includes("expir")) return "วันหมดอายุบัตรไม่ถูกต้อง";
  if (m.includes("security code")) return "รหัส CVV ไม่ถูกต้อง";
  return message;
}

export function luhnValid(digits: string) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function detectBrand(digits: string): string | null {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^35/.test(digits)) return "JCB";
  if (/^3[47]/.test(digits)) return "AMEX";
  return null;
}
