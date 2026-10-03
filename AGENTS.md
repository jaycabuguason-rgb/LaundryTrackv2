## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

## Codebase Safety & Modification Guardrails (STRICT)

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & CODING ASSISTANTS:**
> This codebase contains production-ready, working features. You must **NEVER** modify, refactor, replace, or "re-invent" any existing working functionality unless explicitly and directly commanded by the user.

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

5. **Bug Fix Protocol (Minimal Blast Radius)**:
   - Identify the exact line or timing causing the failure (e.g., race conditions, missing timeouts, CSS margins, event listener cleanup).
   - Apply the surgical fix only at that failure point.
   - DO NOT refactor the architecture or change the data-flow of working components upstream or downstream from the bug.

