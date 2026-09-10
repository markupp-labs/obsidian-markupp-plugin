## Code style

- Functions: 4-20 lines. Split if longer.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`.
  Prefer names that return <5 grep hits in the codebase.
- Types: explicit. No `any`, no `Dict`, no untyped functions.
- No code duplication. Extract shared logic into a function/module.
- Early returns over nested ifs. Max 2 levels of indentation.
- Exception messages must include the offending value and expected shape.

## Tests

- Tests run with a single command: `npm test`.
- Every new function gets a test. Bug fixes get a regression test.
- Mock external I/O (API, DB, filesystem) with named fake classes,
  not inline stubs.
- Tests must be F.I.R.S.T: fast, independent, repeatable,
  self-validating, timely.
- TDD per commit: the first commit of a task brings only the failing
  tests; later commits make them pass.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin interface owned by this project.

## Structure

- Follow the Obsidian plugin convention: `manifest.json`, `main.js` and
  `styles.css` as the installable artifact.
- Prefer small focused modules over god files.
- Predictable paths: `src/api/` (HTTP client), `src/core/` (operations),
  `src/storage/` (note index), `src/ui/` (views and notices).

## Formatting

- `.editorconfig` defines the formatting. Don't discuss style beyond that.
- `npm run lint` (eslint with `eslint-plugin-obsidianmd`) runs in CI; run it
  locally before pushing.

## Logging

- Structured JSON when logging for debugging / observability.
- Plain text only for user-facing CLI output.

## Git Conventions

**Atomic, frequent commits.** One logical change per commit. If the message needs "and", split it. Commit as soon as a unit of work is coherent and tests pass; don't batch unrelated changes. Refactor, feature, and fix go in separate commits even when touching the same file.

**Commit message format.** Conventional Commits, written in Portuguese, no scope in parentheses: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `release:` (sprint consolidation into main), `merge:` (hand-written back-merge). Use `refact:` for refactors, never `refactor:`. Example: `feat: adiciona validação de upload`. The `commit-msg` hook in `.pre-commit-config.yaml` enforces this and rejects emojis, em dashes and tool attribution; install it with `pre-commit install`.

**Branches and PRs.** Branch prefixes mirror the commit types: `feat/`, `fix/`, `refact/` (never `feature/` or `refactor/`, even if old merges show them). Feature work targets `dev` (`--base dev`); only release or milestone consolidation targets `main`. Promote `dev` to `main` with a merge commit, never squash, then back-merge `main` into `dev`. Release tags follow semantic versioning with a `v` prefix (`v1.0.0`, `v1.0.0-rc.1`); the release workflow refuses to publish a tag that does not.

**Templates.** Every issue and pull request must follow the templates in `.github` (`.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md`).

**AI agents never take credit, in any artifact.** An agent is a tool the human uses; the human is the author of the work. Concretely, when authoring or editing on behalf of the user:

- Never add `Co-Authored-By` trailers to commits (the hook blocks them).
- Never list yourself (or any model/tool name) as author, co-author, contributor, decider, reviewer, or signer in frontmatter, YAML headers, author lists, READMEs, ADRs, docstrings, code comments, changelogs, release notes, PR descriptions, or any other versioned artifact.
- Never insert "🤖 Generated with..." or similar attribution footers in commits, PR bodies, or generated files.
- If a template field expects an author/decider/owner, leave it for the human to fill or omit the field; do not put yourself there as a placeholder.
- If asked to remove existing credit attributions, remove them in full rather than substituting another agent name.

The rule applies whether the work is shipped, scaffolded, drafted, or merely staged.

## Writing style

- No emojis anywhere, including repo templates that ship with them.
- No em dashes (`—`); use commas, colons, parentheses, or rephrase.
- Backticks sparingly in prose: mark a term once, not every repetition.

## Decisions

- Decisions belong to the user. List the options and wait for the choice;
  don't fill gaps with reasonable defaults, even small ones.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `markupp-labs/obsidian-markupp-plugin`, driven by
the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings; `bug` and `enhancement`
carry the category roles. See `docs/agents/triage-labels.md`.

### Domain docs

A root `CONTEXT.md` plus `docs/adrs/` for plugin decisions. Decisions about the
server and the REST contract live in `markupp-labs/markupp`. See
`docs/agents/domain.md`.
