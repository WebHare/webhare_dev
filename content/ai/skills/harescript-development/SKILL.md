---
name: harescript-development
description: "Use when writing or modifying HareScript (.whlib or .whscr), including macros, functions, objecttypes, and backend tests. Covers K&R brace style and limiting formatting churn."
---

# HareScript development

Prefer TypeScript for new standalone scripts and tools. When maintaining or extending HareScript:

- For significant new code, such as a macro, function, or objecttype, use K&R style: put opening `<`, `{`, and `[` at the end of the preceding line, before any line comment, rather than on a separate line.
- Apply this style to new blocks and code already being edited for substantive reasons. Do not reformat unrelated existing code or make trivial changes merely to justify brace-style cleanup; keep diffs focused.
- Preserve existing indentation widths.

```harescript
PUBLIC OBJECTTYPE Example <
  PUBLIC MACRO Run() {
    IF(TRUE) { // Opening delimiter precedes the line comment
      RECORD value := [
        enabled := TRUE
      ];
    }
  }
>;
```

Validate changed HareScript files and run the focused affected test following the [running-tests skill](../running-tests/SKILL.md).
