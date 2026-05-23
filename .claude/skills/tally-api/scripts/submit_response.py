"""Tally 폼에 응답을 제출한다. (공개 폼 전용, 인증 불필요)"""

import argparse
import json
import ssl
import sys
import urllib.request
import urllib.error
import uuid

SSL_CTX = ssl.create_default_context()
try:
    import certifi
    SSL_CTX.load_verify_locations(certifi.where())
except ImportError:
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

BASE_URL = "https://api.tally.so"


def submit(form_id: str, responses: dict) -> dict:
    url = f"{BASE_URL}/forms/{form_id}/respond"
    payload = {
        "sessionUuid": str(uuid.uuid4()),
        "respondentUuid": str(uuid.uuid4()),
        "responses": responses,
        "captchas": {},
        "isCompleted": True,
        "password": None,
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "TallyAPIClient/1.0",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=SSL_CTX) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            err = json.loads(raw)
            msg = err.get("message", raw)
        except json.JSONDecodeError:
            msg = raw
        return {"error": True, "code": e.code, "message": msg}


def main():
    parser = argparse.ArgumentParser(description="Tally 폼 응답 제출")
    parser.add_argument("--form-id", required=True, help="대상 폼 ID")
    parser.add_argument("--responses-json", required=True, help="응답 데이터 JSON 파일 경로. {fieldUuid: value} 형식")
    args = parser.parse_args()

    with open(args.responses_json, "r", encoding="utf-8") as f:
        responses = json.load(f)

    result = submit(args.form_id, responses)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
