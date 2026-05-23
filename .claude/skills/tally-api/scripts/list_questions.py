"""Tally 폼의 질문 목록을 조회한다."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import load_token, api_request


def main():
    parser = argparse.ArgumentParser(description="Tally 폼 질문 목록 조회")
    parser.add_argument("--form-id", required=True, help="폼 ID")
    args = parser.parse_args()

    token = load_token()
    result = api_request(f"/forms/{args.form_id}/questions", token)
    if isinstance(result, dict) and result.get("error"):
        print(json.dumps(result, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
