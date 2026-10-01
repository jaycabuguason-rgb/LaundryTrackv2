# Repository Guardrails & AI Modification Policies

## CRITICAL DIRECTIVE: STRICT NON-DESTRUCTIVE MODIFICATION

All existing functionality, components, workflows, and integrations in this codebase are considered working, tested, and intentional. Any AI agent (Antigravity, Gemini, Claude, Cursor, Cline, etc.) operating in this repository MUST strictly follow these rules:

---

### Rule 1: Surgical Fixes Only — Do Not Refactor Working Code
- **Fix the exact defect only**: Focus exclusively on the narrow bug or task requested by the user.
- **No unsolicited refactoring or "modernization"**: Never rewrite, re-architect, replace, or "optimize" working functions, utilities, or components under the assumption of "best practices".
- **Minimal Diff Principle**: Always make the smallest, safest diff necessary to fix the problem. If a 3-line timing or CSS fix resolves an issue, do not replace entire modules or algorithms.

### Rule 2: Preserve Working External APIs, Libraries & Contracts
- **Do not replace working third-party services or APIs**: If the app uses a specific service (e.g. `api.qrserver.com`, Supabase, `@react-pdf/renderer`), keep it intact unless the user explicitly requests a migration.
- **Do not modify working shared utilities**: Shared helpers (in `lib/`, `hooks/`, etc.) must not be rewritten if multiple parts of the system rely on their existing behavior and output format.
- **Do not alter function signatures or return types**: Maintain strict backward compatibility for all existing functions and props.

### Rule 3: Isolate Action-Specific Issues
- If an issue occurs during a specific lifecycle step (e.g., thermal printing, PDF export, or modal open), fix **only that step's execution pipeline** (e.g. timing, rendering buffer, styling, print lifecycle).
- **Never touch the data-generation or source-of-truth logic** that is already working properly elsewhere in the UI.

### Rule 4: Implementation Plans Must Declare Strict Scoping
Whenever asked to create an implementation plan:
1. Identify the root cause precisely without making broad assumptions.
2. Propose the most minimal, surgical solution possible.
3. Explicitly declare what will **NOT** be touched, ensuring working subsystems remain completely undisturbed.

### Rule 5: Immediate Reversion on Regressions
If any change unintentionally affects working behavior outside the user's specific request, revert the affected files immediately back to their previous working commit.
