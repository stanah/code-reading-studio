# Code Reading Studio — Static reading guide

The `dist/` directory contains a buildless HTML/CSS/JavaScript guide for a code-reading study session. The local application is documented in `local-app/README.md`.

## Reading pack and provenance

- Repository: https://github.com/paradigmxyz/reth
- Commit: `1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607` (2026-10-10)
- Topic: `eth_sendRawTransaction` to the transaction pool
- Six steps and five related-code detours with verbatim Rust excerpts, original line numbers, SHA-256 hashes and commit-pinned source links
- Default route: no raw transaction forwarder; blob-sidecar conversion is folded and can be expanded
- Source code licensed under MIT; notice in `dist/reth-LICENSE-MIT.txt` and exported packs

Explanations are prepared reading notes and have not been reviewed for correctness by a human. The static guide does not execute Reth, run its tests, analyze arbitrary repositories, or call a live AI model. A test excerpt describes expected behavior; it is not a record of a test run.

## Reading and presenting

Serve `dist/` with a static HTTP server. There are no build dependencies. Use `lenses.html` to explore the transaction path through structure, behavior and Rust concepts. The selected operation remains available when switching views and opening its source.

In `reader.html`, select a tour step, map node or source line; open Rust language notes; follow the pinned source link. Folded source can be expanded. The map shows a local window of four steps; use the arrows or tour for the full route. Map arrows include evidence for each relationship.

Related-code detours preserve the selected line, language tab and folds for the return to the main route. Any current excerpt can be added to the tour. Notes, review flags, questions and tour position persist in browser localStorage under a commit-scoped Reth key. Export includes notes and source excerpts; review the resulting file before sharing it.

The presentation button opens `?present=1` in another window. BroadcastChannel sends only allowlisted presentation state, excluding presenter notes and questions. Presentation navigation cannot overwrite the saved private session. Real-browser pop-up behavior and cross-window synchronization still require verification.

## Repository atlas

`index.html` shows all 1,301 tracked Rust files at the pinned commit, organized into 11 responsibility areas. Directory rules make classification inspectable; groups are a reading aid, not a resolved dependency graph. Conceptual relationships and four question-based scopes lead into a folder/path explorer. Only the transaction submission path has prepared explanations.

`reader.html?step=<anchor-id>` opens a prepared excerpt, including related-code detours.

The atlas indexes file paths, not symbols or full text. The explorer renders 50 results per page, and source views render 100 lines at a time. Selected entry/source files are included for initial reading. Other indexed files load on demand from `raw.githubusercontent.com` at the pinned commit, without credentials. An in-memory cache retains at most 12 additional files. Requests have a 20-second timeout and a 2 MB text limit. Failed requests offer a retry and a direct GitHub source link. Browser cross-origin fetching must be verified for each hosting environment.

Reading questions can be queued for a whole file or a click/Shift-click line range. Queue execution by AI is not implemented. Queue export includes questions and source references, not source bodies. Atlas state and reading-session state are saved separately. Opening a file records it as opened, not understood or reviewed.

## Progressive reading

The primary area action opens `zoom.html`. Five levels lead from repository responsibilities to area components, module roles, functions and processing stages, and finally source code. The parent explanation and input/output boundary remain visible. URL parameters preserve the component, module and selected function. Source views provide a return link to that context. Direct file search is also available.

RPC has curated component responsibilities and source-backed transaction module descriptions. Prepared function explanations show input, output, side effects, branches and processing phases before offering a source link. Other areas use source-directory partitions; unprepared responsibilities are labeled unknown. Original module/function doc comments supplement the curated content.

Function lists use a bounded lexical scan for line-start Rust `fn` declarations, not AST/LSP analysis. They include trait declarations, implementations and tests; macros and unusual syntax can be missed. Prepared annotations must match both symbol name and source range. On-demand source retrieval and 40-candidate display batches keep exploration within the selected module.

## Generation and verification

Run from the repository root:

```sh
node tests/smoke.cjs
node tests/atlas.cjs
node tests/zoom.cjs
```

These logic tests cover navigation, detours, persistence, source folds and hashes, presentation-state isolation, path partitioning, filters, source windows, queued ranges, pinned fetch URLs, escaping, source-link gating and selected-function restoration. They do not run a browser.

The desktop atlas and progressive reading screens, and the Rust-guide-to-source return path, have been checked in a browser. Full-page visual coverage, smartphone widths, pop-up behavior, cross-window synchronization and use in an actual study session remain unverified. See `docs/HANDOFF.md` for the verification scope.

To regenerate the atlas, use `python3 scripts/build-atlas.py targets/reth` with the target at the documented commit. The generator currently combines a Git tree index with source text read from the working tree. Confirm that the target is clean and at the intended commit before regeneration; reading all source text directly from the pinned commit remains a planned improvement. The target is never executed by the generator.
