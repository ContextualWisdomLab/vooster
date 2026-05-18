# Test Plan

_Append a section per UC before starting it. One bullet per test you intend to
write. This guides your TDD cycles within an iteration._

## Example

### UC-009

- **MAIN**: POST a valid use case → 201 with `key`, body matches input.
- **3a**: title is empty → 400, message includes "title".
- **5a**: primary_actor does not exist → 422.
- **7a**: title is duplicate → 422 with current UC's key in body.
