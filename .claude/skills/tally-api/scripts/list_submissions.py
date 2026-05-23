"""Tally 폼 제출 데이터를 조회한다."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import load_token, api_request


def main():
    parser = argparse.ArgumentParser(description="Tally 폼 제출 목록 조회")
    parser.add_argument("--form-id", required=True, help="폼 ID")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--filter", choices=["all", "completed", "partial"], default="all")
    parser.add_argument("--start-date", help="시작일 (ISO 8601)")
    parser.add_argument("--end-date", help="종료일 (ISO 8601)")
    args = parser.parse_args()

    token = load_token()
    params = {
        "page": args.page,
        "limit": args.limit,
        "filter": args.filter,
        "startDate": args.start_date,
        "endDate": args.end_date,
    }

    result = api_request(f"/forms/{args.form_id}/submissions", token, params=params)
    if isinstance(result, dict) and result.get("error"):
        print(json.dumps(result, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
