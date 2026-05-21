# Test Plan

A **living queue** of tests that are not yet GREEN. Append a section
before writing each test (AGENTS.md Phase 3), then delete that section
the moment the test goes GREEN (AGENTS.md Phase 4). The committed test
files in `tests/` are the source of truth for what has been tested —
this file should never describe a test that already exists.

When `.state/active-goal` is `ALL_DONE`, this file should contain only
the Example section.

## Example

### UC-009

- **MAIN**: POST a valid use case → 201 with `key`, body matches input.
- **3a**: title is empty → 400, message includes "title".
- **5a**: primary_actor does not exist → 422.
- **7a**: title is duplicate → 422 with current UC's key in body.
