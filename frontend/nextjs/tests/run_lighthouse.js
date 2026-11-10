/**
 * Lighthouse audits for the Shopdee storefront (NF-LHT-* public pages, NF-PLT-* logged-in pages).
 *
 * usage (from frontend/nextjs):
 *   node tests/run_lighthouse.js
 * env:
 *   LH_BASE_URL   storefront URL      (default http://localhost       = Docker via nginx)
 *   LH_API_URL    API used to log in  (default http://localhost/api/node)
 *   LH_USER / LH_PASSWORD  customer account for the logged-in audits
 *                 (default perf_tester / password1234; it is registered once if it does not exist)
 *   LH_THRESHOLD  minimum score to pass (default 70)
 *
 * Output: tests/lighthouse-reports/<case>.json (full Lighthouse report) and tests/lighthouse_results.json.
 * A case whose audit fails is reported as "Error" with score null: scores are never made up.
 */
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = (process.env.LH_BASE_URL || "http://localhost").replace(/\/$/, "");
const API_URL = (process.env.LH_API_URL || `${BASE_URL}/api/node`).replace(/\/$/, "");
const USER = process.env.LH_USER || "perf_tester";
const PASSWORD = process.env.LH_PASSWORD || "password1234";
const THRESHOLD = Number(process.env.LH_THRESHOLD || 70);
const AUDIT_TIMEOUT_MS = 180_000;
const DEBUG_PORT = Number(process.env.LH_DEBUG_PORT || 9222);

const REPORTS_DIR = path.join(__dirname, "lighthouse-reports");
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const CASES = [
  // public pages
  { id: "NF-LHT-001", path: "/", category: "performance", formFactor: "desktop" },
  { id: "NF-LHT-002", path: "/", category: "accessibility", formFactor: "desktop" },
  { id: "NF-LHT-003", path: "/products", category: "performance", formFactor: "desktop" },
  { id: "NF-LHT-004", path: "/products/1", category: "seo", formFactor: "desktop" },
  { id: "NF-LHT-005", path: "/", category: "performance", formFactor: "mobile" },
  { id: "NF-LHT-006", path: "/login", category: "seo", formFactor: "desktop" },
  // logged-in pages
  { id: "NF-PLT-001", path: "/profile", category: "performance", formFactor: "desktop", auth: true },
  { id: "NF-PLT-002", path: "/cart", category: "best-practices", formFactor: "desktop", auth: true },
  { id: "NF-PLT-003", path: "/orders", category: "performance", formFactor: "desktop", auth: true },
];

function lighthouseArgs(c, outputPath, extra = []) {
  return [
    "--yes",
    "lighthouse",
    `${BASE_URL}${c.path}`,
    // logged-in audits also collect "performance" so the request list (used to prove the login) is present
    `--only-categories=${c.auth && c.category !== "performance" ? `${c.category},performance` : c.category}`,
    // "--preset=desktop" for desktop; mobile is Lighthouse's default emulation (there is no "mobile" preset)
    ...(c.formFactor === "desktop" ? ["--preset=desktop"] : ["--form-factor=mobile"]),
    "--output=json",
    `--output-path=${outputPath}`,
    "--quiet",
    ...extra,
  ];
}

function runLighthouse(c, extra) {
  const outputPath = path.join(REPORTS_DIR, `${c.id}.json`);
  fs.rmSync(outputPath, { force: true }); // never reuse a report from an earlier run
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, lighthouseArgs(c, outputPath, extra), { stdio: "inherit", timeout: AUDIT_TIMEOUT_MS, shell: process.platform === "win32" });
  if (!fs.existsSync(outputPath)) throw new Error("Lighthouse did not write a report");
  return outputPath;
}

function auditPublic(c) {
  console.log(`\n▶ ${c.id} ${c.category} (${c.formFactor}) ${BASE_URL}${c.path}`);
  return runLighthouse(c, ['--chrome-flags="--headless=new --no-sandbox"']);
}

/**
 * Prepare a Chrome profile that is already logged in:
 * Playwright logs in once with a persistent profile directory and closes, which saves the session
 * (localStorage) to disk. Lighthouse then starts its own Chrome on that same profile.
 * (Attaching Lighthouse to a browser driven by Playwright hangs, and Lighthouse's own launcher replaces
 * --user-data-dir, so Chrome is started directly on the profile and Lighthouse attaches with --port.)
 */
async function prepareLoggedInProfile() {
  const profileDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "shopdee-lh-"));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.LH_CHROME_CHANNEL || "chrome",
    headless: true,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());

    // create the account on first use (409 = already exists, which is fine)
    const reg = await page.request.post(`${API_URL}/register`, { data: { username: USER, password: PASSWORD, firstName: "Perf", lastName: "Tester" } });
    if (![200, 409].includes(reg.status())) console.warn(`register ${USER}: HTTP ${reg.status()}`);

    await page.goto(`${BASE_URL}/login`);
    await page.getByRole("button", { name: "ลูกค้า", exact: true }).click();
    await page.fill("#username", USER);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    const token = await page.evaluate(() => localStorage.getItem("shopdee_token"));
    if (!token) throw new Error(`login as ${USER} failed`);
    console.log(`Logged in as ${USER}`);
  } finally {
    await context.close(); // flushes localStorage to the profile directory
  }
  return profileDir;
}

/** Installed Chrome (LH_CHROME_PATH to override), else Playwright's Chromium. */
function chromePath() {
  const candidates = [
    process.env.LH_CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || chromium.executablePath();
}

/** Start Chrome on the logged-in profile with a DevTools port Lighthouse can attach to. */
async function startChrome(profileDir) {
  const { spawn } = require("child_process");
  const proc = spawn(chromePath(), [
    "--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--no-sandbox", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("Chrome did not open the DevTools port");
}

function auditLoggedIn(c) {
  console.log(`
▶ ${c.id} ${c.category} (${c.formFactor}, logged in) ${BASE_URL}${c.path}`);
  const report = runLighthouse(c, [`--port=${DEBUG_PORT}`, "--disable-storage-reset"]);
  assertLoggedIn(c, report);
  return report;
}

/** A logged-in page must have called the customer API; otherwise the audit measured the login prompt. */
function assertLoggedIn(c, reportPath) {
  const json = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const urls = (json.audits?.["network-requests"]?.details?.items || []).map((i) => i.url);
  if (!urls.some((u) => /\/(profile|cart|history)\/\d+/.test(u))) {
    throw new Error("page was not loaded as a logged-in customer (no customer API call), score discarded");
  }
}

function summarise(reportPath, categoryKey) {
  const json = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const raw = json.categories?.[categoryKey]?.score;
  if (typeof raw !== "number") throw new Error(`no ${categoryKey} score in report`);
  const score = Math.round(raw * 100);
  let notes = `Score: ${score}`;
  if (categoryKey === "performance") {
    const a = json.audits || {};
    notes += ` (LCP: ${a["largest-contentful-paint"]?.displayValue}, CLS: ${a["cumulative-layout-shift"]?.displayValue}, TBT: ${a["total-blocking-time"]?.displayValue})`;
  }
  return { score, notes, status: score >= THRESHOLD ? "Pass" : "Fail", url: json.finalDisplayedUrl || json.finalUrl, fetchedAt: json.fetchTime };
}

async function main() {
  const results = {};
  const record = (c, fn) => {
    try {
      results[c.id] = summarise(fn(c), c.category);
    } catch (err) {
      results[c.id] = { score: null, notes: `Audit failed: ${err.message}`, status: "Error" };
    }
    console.log(`${c.id}: ${results[c.id].status} ${results[c.id].score ?? ""} ${results[c.id].notes}`);
  };

  for (const c of CASES.filter((x) => !x.auth)) record(c, auditPublic);

  let profileDir;
  let chrome;
  try {
    profileDir = await prepareLoggedInProfile();
    chrome = await startChrome(profileDir);
    for (const c of CASES.filter((x) => x.auth)) record(c, auditLoggedIn);
  } catch (err) {
    for (const c of CASES.filter((x) => x.auth && !results[x.id])) {
      results[c.id] = { score: null, notes: `Audit failed: ${err.message}`, status: "Error" };
    }
  } finally {
    chrome?.kill();
    await new Promise((r) => setTimeout(r, 1000)); // let Chrome release the profile
    if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
  }

  fs.writeFileSync(path.join(__dirname, "lighthouse_results.json"), JSON.stringify(results, null, 2), "utf-8");
  console.log("\nSaved tests/lighthouse_results.json");
  const bad = Object.entries(results).filter(([, r]) => r.status !== "Pass");
  if (bad.length) {
    console.log(`Not passing: ${bad.map(([id, r]) => `${id}=${r.status}`).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Lighthouse run failed:", err);
  process.exit(1);
});
