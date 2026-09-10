# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, when present.
- **`docs/adrs/`** for decisions scoped to the plugin. Note the directory is `adrs`, plural.
- Decisions about the server and the REST contract live in `markupp-labs/markupp`, under
  `docs/adrs/` there. Read them when the change touches the contract.

If any of these files do not exist, proceed silently. Do not flag their absence and do
not suggest creating them upfront. The `/domain-modeling` skill creates them lazily when
terms or decisions actually get resolved.

## File structure

    /
    |- CONTEXT.md
    |- docs/adrs/                       plugin decisions, ADR-0001 onwards
    `- src/
        |- api/                         cliente HTTP do servidor Markupp
        |- core/                        operacoes fetch/pull/push/sync
        |- storage/                     indice local de notas
        `- ui/                          notificacoes e source control view

Existing ADRs are named `ADR-NNNN-slug-em-portugues.md` and are written in Portuguese.
Keep that convention for new ones.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in `CONTEXT.md`. Do not drift to
synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal: either you are
inventing language the project does not use (reconsider) or there is a real gap (note it
for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding:

> Contradicts ADR-0003 (source control view), but worth reopening because...
