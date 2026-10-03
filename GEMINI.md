# Codebase Guardrails & Modification Policy (STRICT)

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & CODING ASSISTANTS:**
> This codebase contains production-ready, working features. You must **NEVER** modify, refactor, replace, or "re-invent" any existing working functionality unless explicitly and directly commanded by the user.

---

## 1. Zero Unsolicited Modification Rule (Strictly Enforced)

1. **Touch Only What Was Explicitly Asked**:
   - Confine changes **strictly** to the exact file, component, or function requested by the user.
   - If the user asks to fix an issue in feature X (e.g., thermal printing dialog), **NEVER** touch feature Y (e.g., QR generation API, data formats, tracking routes, PDF generation, or state stores).

2. **Never Replace Working Implementations**:
   - Do **NOT** replace working third-party services, APIs, libraries, or utilities with custom or rewritten implementations unless the user explicitly asks to replace that service.
   - Do **NOT** "improve", rewrite, optimize, or modernize code outside the immediate task. Working code must remain working.

3. **Preserve Existing Data Contracts & APIs**:
   - Never alter function signatures, return types, public API routes, tracking URLs, or database schemas that other parts of the app depend on.
   - Any external integration (e.g., `api.qrserver.com`, Supabase schemas, localStorage keys, routing tokens) is considered frozen and must be preserved.

4. **Preserve Surrounding Code & Comments**:
   - Do not delete comments, remove features, simplify logic, or change formatting/styling of unrelated sections of files you are editing.

---

## 2. Bug Fix Protocol: Minimal Blast Radius

When fixing a bug:
1. **Identify the exact line or timing causing the failure** (e.g., race conditions, missing timeouts, CSS margins, event listener cleanup).
2. **Apply the surgical fix only at that failure point**.
3. **DO NOT refactor the architecture** or change the data-flow of working components upstream or downstream from the bug.

---

## 3. Plan & Verify Requirement

Before modifying any code:
1. **Verify Scope**: Confirm which exact files and functions will be modified.
2. **Regression Check**: Ensure no existing feature, contract, or behavior is broken or altered.
3. **Test Integrity**: Run relevant tests (`pnpm test`) after modifications to ensure existing functionality remains 100% operational.
