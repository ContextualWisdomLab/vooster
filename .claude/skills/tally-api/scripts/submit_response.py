"""Tally 폼에 응답을 제출한다. (공개 폼 전용, 인증 불필요)"""

import argparse
import json
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import SSL_CTX, build_api_url, send_json_request


def build_form_response_url(form_id: str) -> str:
    """Build a response URL from one opaque Tally form identifier."""
    if re.fullmatch(r"[A-Za-z0-9_-]+", form_id) is None:
        raise ValueError("Tally form ID contains unsupported characters")
    return build_api_url(f"/forms/{form_id}/respond")


def submit(form_id: str, responses: dict) -> dict:
    url = build_form_response_url(form_id)
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
    return send_json_request(url, "POST", headers, body)


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
