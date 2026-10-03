"""Tally API 공통 HTTP 클라이언트."""

import json
import http.client
import socket
import ssl
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
    pass

BASE_URL = "https://api.tally.so"


def build_api_url(endpoint: str, params: dict = None) -> str:
    """Build a request URL that cannot leave the fixed Tally HTTPS origin."""
    if not endpoint.startswith("/") or endpoint.startswith("//"):
        raise ValueError("Tally API endpoint must be an origin-relative path")
    url = f"{BASE_URL}{endpoint}"
    parsed = urllib.parse.urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "api.tally.so"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Tally API endpoint must stay on https://api.tally.so")
    if params:
        filtered = {key: value for key, value in params.items() if value is not None}
        if filtered:
            url += "?" + urllib.parse.urlencode(filtered)
    return url


def create_tally_connection() -> http.client.HTTPConnection:
    """Create an HTTP client over a verified socket pinned to Tally."""
    raw_socket = socket.create_connection(("api.tally.so", 443))
    try:
        tls_socket = SSL_CTX.wrap_socket(raw_socket, server_hostname="api.tally.so")
    except Exception:
        raw_socket.close()
        raise
    connection = http.client.HTTPConnection("api.tally.so")
    connection.sock = tls_socket
    return connection


def send_json_request(
    url: str,
    method: str,
    headers: dict,
    body: bytes = None,
) -> dict:
    """Send JSON over a TLS connection pinned to the Tally API authority."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc != "api.tally.so":
        raise ValueError("Tally request URL must use the fixed HTTPS authority")
    target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
    connection = create_tally_connection()
    try:
        connection.request(method, target, body=body, headers=headers)
        response = connection.getresponse()
        raw = response.read()
    finally:
        connection.close()
    if response.status >= 400:
        return error_response(response.status, raw)
    if not raw:
        return {"success": True}
    return json.loads(raw)


def error_response(status: int, raw: bytes) -> dict:
    """Translate one non-success Tally response into the skill error contract."""
    decoded = raw.decode()
    try:
        payload = json.loads(decoded)
        message = payload.get("message", decoded)
    except json.JSONDecodeError:
        message = decoded
    return {"error": True, "code": status, "message": message}


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
    url = build_api_url(endpoint, params)

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "TallyAPIClient/1.0",
        "Accept": "application/json",
    }
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    return send_json_request(url, method, headers, body)
