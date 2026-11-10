"""
Copy jmeter_results.json (written by run_load_test.py) into the JMeter test-case workbook.

usage:  python tests/jmeter_script/generate_jmeter_results.py
input:  tests/template/JMeter_Test_Cases_Template.xlsx + tests/jmeter_script/jmeter_results.json
output: tests/test-results/JMeter_Test_Cases.xlsx
"""
import json
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

TESTS_DIR = Path(__file__).resolve().parent.parent
TEMPLATE = TESTS_DIR / "template" / "JMeter_Test_Cases_Template.xlsx"
RESULTS_JSON = TESTS_DIR / "jmeter_script" / "jmeter_results.json"
OUTPUT = TESTS_DIR / "test-results" / "JMeter_Test_Cases.xlsx"
SHEET = "⚡ JMeter Test Cases"

# columns in the "JMeter Test Cases" sheet (header row 4)
COL_ID, COL_ACTUAL, COL_STATUS, COL_TESTER, COL_DATE = 1, 10, 11, 12, 13


def main():
    if not RESULTS_JSON.exists():
        sys.exit(f"{RESULTS_JSON} not found: run run_load_test.py first")
    results = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
    meta = results.pop("_meta", {})
    executed = meta.get("executed_at")
    run_date = datetime.fromisoformat(executed).date().isoformat() if executed else date.today().isoformat()

    wb = openpyxl.load_workbook(TEMPLATE)
    sheet = wb[SHEET]
    updated = 0
    for r in range(5, sheet.max_row + 1):
        tc_id = sheet.cell(row=r, column=COL_ID).value
        if tc_id not in results:
            continue
        res = results[tc_id]
        sheet.cell(row=r, column=COL_ACTUAL, value=res["notes"])
        sheet.cell(row=r, column=COL_STATUS, value=res["status"])
        sheet.cell(row=r, column=COL_TESTER, value=sheet.cell(row=r, column=COL_TESTER).value or "QA-Perf")
        sheet.cell(row=r, column=COL_DATE, value=run_date if res["status"] != "Not Run" else None)
        print(f"{tc_id}: {res['status']}")
        updated += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT)
    print(f"Updated {updated} cases ({meta.get('profile', '?')} profile) -> {OUTPUT}")


if __name__ == "__main__":
    main()
