"""Tally API 공통 HTTP 클라이언트."""

import json
import ssl
import urllib.request
import urllib.error
import urllib.parse
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TOKEN_FILE = DATA_DIR / "token.txt"

SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

BASE_URL = "https://api.tally.so"


def load_token() -> str:
    if not TOKEN_FILE.exists():
        print("✗ API Key가 설정되지 않았습니다. setup_token.py를 먼저 실행하세요.", file=sys.stderr)
        sys.exit(1)
    token = TOKEN_FILE.read_text().strip()
    if not token:
        print("✗ API Key 파일이 비어있습니다.", file=sys.stderr)
        sys.exit(1)
    return token


def api_request(
    endpoint: str,
    token: str,
    method: str = "GET",
    data: dict = None,
    params: dict = None,
):
    """Tally API에 요청을 보낸다."""
    url = f"{BASE_URL}{endpoint}"
    if params:
        filtered = {k: v for k, v in params.items() if v is not None}
        if filtered:
            url += "?" + urllib.parse.urlencode(filtered)

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "TallyAPIClient/1.0",
        "Accept": "application/json",
    }
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=SSL_CTX) as resp:
            raw = resp.read()
            if not raw:
                return {"success": True}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            err = json.loads(raw)
            msg = err.get("message", raw)
        except json.JSONDecodeError:
            msg = raw
        return {"error": True, "code": e.code, "message": msg}
