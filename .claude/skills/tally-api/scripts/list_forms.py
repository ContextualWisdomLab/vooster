"""Tally 폼 목록을 조회한다."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import load_token, api_request


def main():
    parser = argparse.ArgumentParser(description="Tally 폼 목록 조회")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--workspace-id", help="특정 워크스페이스의 폼만 조회")
    args = parser.parse_args()

    token = load_token()
    params = {"page": args.page, "limit": args.limit}
    if args.workspace_id:
        params["workspaceIds"] = args.workspace_id

    result = api_request("/forms", token, params=params)
    if isinstance(result, dict) and result.get("error"):
        print(json.dumps(result, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
