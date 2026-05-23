"""Tally에 새 폼을 생성한다."""

import argparse
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api_client import load_token, api_request


def _uid() -> str:
    return str(uuid.uuid4())


def make_block(block_type: str, title: str = "", required: bool = True) -> dict:
    """Tally 블록을 생성한다. uuid와 groupUuid를 자동 할당."""
    group_uuid = _uid()
    block = {
        "uuid": _uid(),
        "type": block_type,
        "groupUuid": group_uuid,
        "groupType": block_type,
        "payload": {},
    }
    if block_type == "FORM_TITLE":
        block["groupType"] = "TEXT"
        block["payload"] = {
            "safeHTMLSchema": [[title]],
            "title": title,
        }
    elif block_type in (
        "INPUT_TEXT",
        "INPUT_EMAIL",
        "INPUT_PHONE_NUMBER",
        "INPUT_NUMBER",
        "INPUT_LINK",
        "TEXTAREA",
    ):
        block["payload"] = {"isRequired": required, "placeholder": ""}
    return block


def make_dropdown_options(options: list[str]) -> list[dict]:
    """DROPDOWN_OPTION 블록 리스트를 생성한다. 동일한 groupUuid를 공유."""
    shared_group = _uid()
    blocks = []
    for i, opt in enumerate(options):
        blocks.append({
            "uuid": _uid(),
            "type": "DROPDOWN_OPTION",
            "groupUuid": shared_group,
            "groupType": "DROPDOWN",
            "payload": {
                "index": i,
                "text": opt,
                "isFirst": i == 0,
                "isLast": i == len(options) - 1,
            },
        })
    return blocks


def make_checkbox_options(options: list[str]) -> list[dict]:
    """CHECKBOX 블록 리스트를 생성한다. 동일한 groupUuid를 공유."""
    shared_group = _uid()
    blocks = []
    for i, opt in enumerate(options):
        blocks.append({
            "uuid": _uid(),
            "type": "CHECKBOX",
            "groupUuid": shared_group,
            "groupType": "CHECKBOXES",
            "payload": {
                "index": i,
                "text": opt,
                "isFirst": i == 0,
                "isLast": i == len(options) - 1,
            },
        })
    return blocks


def make_title_block(title: str) -> dict:
    """질문 라벨 TITLE 블록을 생성한다."""
    return {
        "uuid": _uid(),
        "type": "TITLE",
        "groupUuid": _uid(),
        "groupType": "QUESTION",
        "payload": {"safeHTMLSchema": [[title]]},
    }


def build_blocks_from_fields(title: str, fields: list[dict]) -> list[dict]:
    """간단한 필드 정의 리스트로부터 Tally 블록 배열을 생성한다.

    fields 예시:
      [
        {"type": "INPUT_TEXT", "title": "이름", "required": true},
        {"type": "DROPDOWN", "title": "직무", "options": ["개발자", "디자이너"]},
        {"type": "CHECKBOXES", "title": "도구", "options": ["Cursor", "Claude Code"]}
      ]
    """
    blocks = [make_block("FORM_TITLE", title)]
    for field in fields:
        field_type = field["type"]
        field_title = field.get("title", "")

        if field_type == "DROPDOWN":
            blocks.append(make_title_block(field_title))
            blocks.extend(make_dropdown_options(field.get("options", [])))
        elif field_type == "CHECKBOXES":
            blocks.append(make_title_block(field_title))
            blocks.extend(make_checkbox_options(field.get("options", [])))
        else:
            blocks.append(make_title_block(field_title))
            blocks.append(
                make_block(
                    field_type,
                    field_title,
                    field.get("required", True),
                )
            )
    return blocks


def main():
    parser = argparse.ArgumentParser(description="Tally 폼 생성")
    parser.add_argument("--title", required=True, help="폼 제목")
    parser.add_argument("--workspace-id", help="워크스페이스 ID")
    parser.add_argument("--status", default="DRAFT", choices=["DRAFT", "PUBLISHED"])
    parser.add_argument(
        "--blocks-json",
        help="블록 정의 JSON 파일 경로 (Tally 원본 블록 형식 또는 간단한 필드 정의)",
    )
    parser.add_argument(
        "--fields-json",
        help='간단한 필드 정의 JSON 파일 경로. 예: [{"type":"INPUT_TEXT","title":"이름"}]',
    )
    args = parser.parse_args()

    token = load_token()

    data = {"title": args.title, "status": args.status}
    if args.workspace_id:
        data["workspaceId"] = args.workspace_id

    if args.blocks_json:
        blocks_path = Path(args.blocks_json)
        if not blocks_path.exists():
            print(f"✗ 블록 JSON 파일을 찾을 수 없습니다: {args.blocks_json}", file=sys.stderr)
            sys.exit(1)
        data["blocks"] = json.loads(blocks_path.read_text())
    elif args.fields_json:
        fields_path = Path(args.fields_json)
        if not fields_path.exists():
            print(f"✗ 필드 JSON 파일을 찾을 수 없습니다: {args.fields_json}", file=sys.stderr)
            sys.exit(1)
        fields = json.loads(fields_path.read_text())
        data["blocks"] = build_blocks_from_fields(args.title, fields)
    else:
        # 블록 미지정 시 제목만 있는 빈 폼 생성
        data["blocks"] = [make_block("FORM_TITLE", args.title)]

    result = api_request("/forms", token, method="POST", data=data)
    if isinstance(result, dict) and result.get("error"):
        print(json.dumps(result, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
