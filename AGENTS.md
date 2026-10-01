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

## Repository Guardrails & Non-Destructive Code Modification Policy

### CRITICAL DIRECTIVE: DO NOT TOUCH WORKING CODE
All existing features, APIs, external integrations, and components are assumed to be working, intentional, and tested. AI assistants MUST adhere to the following:

1. **Surgical Fixes Only**: Fix only the specific bug or task explicitly requested by the user. Do not expand scope.
2. **No Unsolicited Refactoring**: Never rewrite, re-architect, replace, or "modernize" working functions, components, or libraries under the assumption of "best practices".
3. **Preserve External APIs & Contracts**: Keep existing third-party services (e.g. `api.qrserver.com`, Supabase, `@react-pdf/renderer`) and data models intact unless the user explicitly requests a replacement.
4. **Isolate Lifecycle/Action Issues**: If an issue occurs during a specific step (e.g., printing or downloading), modify ONLY that step's execution pipeline. Never alter the underlying source of truth or shared generators that work elsewhere.
5. **Minimal Diff Principle**: Always implement the smallest, least intrusive fix possible.
6. **Implementation Plans**: Every plan must state what will be changed AND explicitly confirm what will NOT be touched.
