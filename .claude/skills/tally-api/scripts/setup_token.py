"""Tally API Key를 저장하고 유효성을 검증한다."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import api_request, DATA_DIR, TOKEN_FILE


def validate_token(token: str) -> bool:
    """Tally API에 /forms 요청하여 Key가 유효한지 확인한다."""
    result = api_request("/forms", token, params={"limit": 1})
    if isinstance(result, dict) and result.get("error"):
        print(f"✗ API Key 인증 실패 (HTTP {result['code']}): {result['message']}")
        return False
    total = result.get("total", 0)
    print(f"✓ 인증 성공 (폼 {total}개 확인)")
    return True


def save_token(token: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token.strip())
    print(f"✓ API Key 저장 완료: {TOKEN_FILE}")


def main():
    parser = argparse.ArgumentParser(description="Tally API Key 설정")
    parser.add_argument("--token", required=True, help="Tally API Key")
    parser.add_argument("--skip-validation", action="store_true")
    args = parser.parse_args()

    token = args.token.strip()
    if not token:
        print("✗ API Key가 비어있습니다.")
        sys.exit(1)

    if not args.skip_validation:
        if not validate_token(token):
            sys.exit(1)

    save_token(token)


if __name__ == "__main__":
    main()
