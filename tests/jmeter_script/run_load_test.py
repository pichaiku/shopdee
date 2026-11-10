"""
Run the Shopdee JMeter plan and turn the measurements into jmeter_results.json.

usage (from anywhere):
  python tests/jmeter_script/run_load_test.py                 # quick profile (~6 min, laptop friendly)
  python tests/jmeter_script/run_load_test.py --profile full  # load parameters of the test-case template (hours)
  python tests/jmeter_script/run_load_test.py --jmeter C:/jmeter/bin/jmeter.bat --host localhost --port 80

Every number written to jmeter_results.json is measured from the JTL file of this run.
A case with no samples (e.g. JM-CHK-002, disabled because it creates real orders) is "Not Run".
SLA thresholds come from tests/template/JMeter_Test_Cases_Template.xlsx.
"""
import argparse
import csv
import json
import os
import shutil
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
PLAN = HERE / "shopdee_load_test.jmx"
RESULTS_JSON = HERE / "jmeter_results.json"
OUT_DIR = HERE / "out"

CASES = ["JM-AUTH-001", "JM-AUTH-002", "JM-PRD-001", "JM-PRD-002", "JM-CHK-001", "JM-CHK-002", "JM-DB-001", "JM-SYS-001"]

# users, ramp-up (s), duration (s) per case
PROFILES = {
    "quick": {
        "JM-AUTH-001": (20, 5, 30),
        "JM-AUTH-002": (100, 30, 45),
        "JM-PRD-001": (50, 5, 30),
        "JM-PRD-002": (200, 2, 20),
        "JM-CHK-001": (20, 5, 30),
        "JM-CHK-002": (20, 5, 30),
        "JM-DB-001": (20, 5, 30),
        "JM-SYS-001": (20, 5, 120),
    },
    "full": {  # = template
        "JM-AUTH-001": (200, 20, 600),
        "JM-AUTH-002": (1000, 300, 900),
        "JM-PRD-001": (500, 50, 900),
        "JM-PRD-002": (1200, 5, 180),
        "JM-CHK-001": (300, 30, 600),
        "JM-CHK-002": (800, 10, 300),
        "JM-DB-001": (100, 10, 300),
        "JM-SYS-001": (150, 30, 14400),
    },
}


def find_jmeter(explicit):
    candidates = [explicit, os.environ.get("JMETER_BIN"), shutil.which("jmeter"), shutil.which("jmeter.bat"), "C:/jmeter/bin/jmeter.bat"]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit("JMeter not found: pass --jmeter or set JMETER_BIN")


def docker_mem(container):
    """Memory usage of a container (e.g. '85.3MiB'), or None when docker is not available."""
    try:
        out = subprocess.run(["docker", "stats", container, "--no-stream", "--format", "{{.MemUsage}}"], capture_output=True, text=True, timeout=30)
        return out.stdout.strip().split(" / ")[0] or None
    except Exception:
        return None


def run_jmeter(jmeter, profile, args):
    OUT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    jtl = OUT_DIR / f"results-{stamp}.jtl"
    report = OUT_DIR / f"report-{stamp}"
    props = [f"-Jhost={args.host}", f"-Jport={args.port}", f"-Jbase={args.base}", f"-Jthink_ms={args.think_ms}",
             "-Jjmeter.save.saveservice.output_format=csv"]
    for case, (users, ramp, duration) in PROFILES[profile].items():
        key = case.lower().replace("-", "_")
        props += [f"-J{key}_users={users}", f"-J{key}_ramp={ramp}", f"-J{key}_duration={duration}"]
    cmd = [jmeter, "-n", "-t", str(PLAN), "-l", str(jtl), "-e", "-o", str(report), *props]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, shell=sys.platform == "win32")
    return jtl, report


def load_samples(jtl):
    by_case = {c: [] for c in CASES}
    with open(jtl, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            label = row["label"]
            if "setup" in label.lower():
                continue  # one-off logins / register, not part of the measured load
            case = label.split(" ")[0]
            if case in by_case:
                by_case[case].append({
                    "t": int(row["timeStamp"]), "elapsed": int(row["elapsed"]),
                    "ok": row["success"].lower() == "true", "code": row["responseCode"],
                })
    return by_case


def stats(samples):
    elapsed = sorted(s["elapsed"] for s in samples)
    n = len(elapsed)
    span = (max(s["t"] + s["elapsed"] for s in samples) - min(s["t"] for s in samples)) / 1000 or 1
    pct = lambda p: elapsed[min(n - 1, int(round(p / 100 * n + 0.5)) - 1)]
    errors = sum(1 for s in samples if not s["ok"])
    return {
        "samples": n, "error_rate": errors / n * 100, "avg": statistics.fmean(elapsed),
        "p90": pct(90), "p95": pct(95), "max": elapsed[-1], "throughput": n / span,
    }


def thirds_drift(samples):
    s = sorted(samples, key=lambda x: x["t"])
    k = max(1, len(s) // 3)
    first, last = statistics.fmean(x["elapsed"] for x in s[:k]), statistics.fmean(x["elapsed"] for x in s[-k:])
    return first, last


def evaluate(case, samples, profile, users, extra):
    if not samples:
        reason = "thread group disabled (creates real orders; enable only on a disposable DB)" if case == "JM-CHK-002" else "no samples recorded"
        return {"notes": f"Not executed: {reason}", "status": "Not Run"}
    m = stats(samples)
    base = f"{users} VUs ({profile}); n={m['samples']}, Error: {m['error_rate']:.2f}%, Avg RT: {m['avg']:.0f}ms, 90th: {m['p90']}ms, Throughput: {m['throughput']:.1f} req/s"
    checks = []
    if case == "JM-AUTH-001":
        checks = [m["error_rate"] < 0.5, m["avg"] < 500]
        if profile == "full":
            checks.append(m["throughput"] > 150)
        else:
            base += " (throughput SLA >150 req/s only checked in the full profile)"
    elif case == "JM-AUTH-002":
        saturated = m["error_rate"] > 5 or m["avg"] > 2000
        base += f" -> {'saturation reached' if saturated else 'no saturation'} at {users} VUs (max RT {m['max']}ms)"
        checks = [True]  # the case is exploratory: it passes when the saturation point is measured
    elif case == "JM-PRD-001":
        checks = [m["error_rate"] < 0.1, m["avg"] < 400, m["p90"] < 800]
    elif case == "JM-PRD-002":
        first, last = thirds_drift(samples)
        base += f", RT first/last third: {first:.0f}/{last:.0f}ms"
        checks = [m["error_rate"] < 2]
    elif case == "JM-CHK-001":
        checks = [m["error_rate"] < 0.5, m["avg"] < 600]
    elif case == "JM-CHK-002":
        checks = [m["error_rate"] < 5]
    elif case == "JM-DB-001":
        base += " (order-history query measured end-to-end through GET /api/history)"
        checks = [m["avg"] < 100]
    elif case == "JM-SYS-001":
        first, last = thirds_drift(samples)
        base += f", RT first/last third: {first:.0f}/{last:.0f}ms"
        if extra.get("mem_before") and extra.get("mem_after"):
            base += f", express memory {extra['mem_before']} -> {extra['mem_after']}"
        checks = [m["error_rate"] < 1, last <= first * 1.5 + 20]
    return {"notes": base, "status": "Pass" if all(checks) else "Fail", "metrics": {k: round(v, 2) for k, v in m.items()}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", choices=PROFILES, default="quick")
    ap.add_argument("--jmeter")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", default="80")
    ap.add_argument("--base", default="/api/node")
    ap.add_argument("--think-ms", default="1000")
    ap.add_argument("--jtl", help="evaluate an existing JTL instead of running JMeter")
    args = ap.parse_args()

    extra = {}
    if args.jtl:
        jtl, report = Path(args.jtl), None
    else:
        extra["mem_before"] = docker_mem("express")
        jtl, report = run_jmeter(find_jmeter(args.jmeter), args.profile, args)
        extra["mem_after"] = docker_mem("express")

    samples = load_samples(jtl)
    results = {}
    for case in CASES:
        users = PROFILES[args.profile][case][0]
        results[case] = evaluate(case, samples[case], args.profile, users, extra)
        print(f"{case}: {results[case]['status']:8} {results[case]['notes']}")
    results["_meta"] = {"profile": args.profile, "executed_at": datetime.now().isoformat(timespec="seconds"), "jtl": str(jtl), "html_report": str(report) if report else None}

    RESULTS_JSON.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {RESULTS_JSON}")


if __name__ == "__main__":
    main()
