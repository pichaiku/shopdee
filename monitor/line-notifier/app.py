"""Relay: Grafana webhook contact point -> LINE Messaging API (push / multicast)

Grafana POSTs its standard webhook JSON to http://line-notifier:8080/grafana

env:
  LINE_CHANNEL_ACCESS_TOKEN  long-lived channel access token (LINE Developers > Messaging API)
  LINE_TO                    userId / groupId / roomId (comma-separated userIds => multicast)
If the token or LINE_TO is empty, messages are only logged (handy for testing).
"""
import logging
import os
import re
from datetime import datetime, timedelta, timezone

import requests
from flask import Flask, jsonify, request

TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
TO = [s.strip() for s in os.getenv("LINE_TO", "").split(",") if s.strip()]
LINE_API = "https://api.line.me/v2/bot/message"
LINE_TEXT_LIMIT = 4900  # LINE allows 5000 characters per text message
BANGKOK = timezone(timedelta(hours=7))  # Thailand has no DST

logging.basicConfig(level=logging.INFO, format="[line-notifier] %(message)s")
log = logging.getLogger("line-notifier")

app = Flask(__name__)


def configured() -> bool:
    return bool(TOKEN and TO)


def fmt_time(iso: str | None) -> str:
    """Grafana time (RFC3339, may have nanoseconds) -> Thai date, e.g. 11/11/2569 01:07:30"""
    if not iso:
        return "-"
    try:
        # drop fractional seconds (Grafana may send 9 digits) and normalise "Z"
        clean = re.sub(r"\.\d+", "", iso).replace("Z", "+00:00")
        d = datetime.fromisoformat(clean)
    except ValueError:
        return "-"
    if d.year < 2000:  # Grafana uses 0001-01-01 for "not set"
        return "-"
    d = d.astimezone(BANGKOK)
    return f"{d.day}/{d.month}/{d.year + 543} {d:%H:%M:%S}"


def build_text(payload: dict) -> str:
    lines = []
    for a in payload.get("alerts") or []:
        labels = a.get("labels") or {}
        annotations = a.get("annotations") or {}
        down = a.get("status") == "firing"
        name = labels.get("service") or labels.get("alertname") or "service"

        if down:
            text = f"🔴 [DOWN] {name}"
            if annotations.get("summary"):
                text += f"\n{annotations['summary']}"
            text += f"\nเริ่ม: {fmt_time(a.get('startsAt'))}"
        else:
            text = f"🟢 [UP] {name}\nกลับมาทำงานปกติแล้ว\nกลับมาใช้งานได้: {fmt_time(a.get('endsAt'))}"
        lines.append(text)

    text = "\n\n".join(lines) or f"[{payload.get('status')}] {payload.get('title') or 'Grafana alert'}"
    return text if len(text) <= LINE_TEXT_LIMIT else text[:LINE_TEXT_LIMIT] + "…"


def send_line(text: str) -> None:
    if not configured():
        log.info("(not configured, log only)\n%s", text)
        return
    multicast = len(TO) > 1
    res = requests.post(
        f"{LINE_API}/{'multicast' if multicast else 'push'}",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"to": TO if multicast else TO[0], "messages": [{"type": "text", "text": text}]},
        timeout=10,
    )
    if not res.ok:
        raise RuntimeError(f"LINE API {res.status_code}: {res.text}")
    log.info("sent to LINE (%d recipient/s)", len(TO))


@app.get("/health")
def health():
    return jsonify(status="ok", configured=configured())


@app.post("/grafana")
def grafana():
    try:
        send_line(build_text(request.get_json(force=True, silent=True) or {}))
        return jsonify(status="ok")
    except Exception as e:  # non-2xx makes Grafana retry and show the error on the contact point
        log.error("%s", e)
        return jsonify(status="error", message=str(e)), 502


log.info("ready (configured=%s)", configured())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
