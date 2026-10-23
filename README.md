# dotpi

My [pi](https://github.com/earendil-works/pi) setup — the contents of `~/.pi/agent`
that are worth version control.

## Structure

```
~/.pi/agent/
├── AGENTS.md              # Voice and working standards, applied to every session
├── SYSTEM.md              # Custom system prompt, replacing pi's default
├── settings.json          # Model, thinking level, installed packages
├── extensions/
│   └── no-sed-edit.ts     # Refuses sed file edits; directs to the edit tool
├── reminders/
│   └── read-fully.ts      # Nudges toward full reads after repeated searching
└── prompts/
    ├── pristine.md        # /pristine — reread what you just wrote; is it clean and pristine?
    ├── reread.md          # /reread — reread changed code and bring it to standard
    ├── taxonomy.md        # /taxonomy — find and fix closed-set ownership drift
    └── progressive-disclosure-descriptions-for-vex.md
                           # check plugin descriptions for Vex progressive disclosure
```

Not tracked here: `auth.json` and `models.json` hold credentials; `runline.json`,
`trust.json` and `keybindings.json` are machine-specific; and `sessions/`,
`recall/`, `peers/`, `npm/`, `git/` and `bin/` are runtime state. All of it is
listed in `.gitignore` so a stray copy cannot be committed by accident.

`settings.json` is safe to track — it holds no credentials, and its package
paths are relative to `~/.pi/agent`, so they carry no username.

## AGENTS.md

The behavioral contract, and the file with the most influence over how a session
reads. It covers voice, the shape of status and completion replies, how to
disagree and how to accept a correction, surgical edits against full reads,
honest reporting of test and verification results, running the verification gate
before claiming completion, tmux for background work, and reaching Linear
through Runline.

pi loads it as a context file in every session.

## SYSTEM.md

Replaces pi's default system prompt with a trimmed version. pi still appends the
date, working directory, skills, and context files.

The tool list stays in step with what is actually installed, so it names the
custom tools alongside the built-in four. Guidelines that a mechanism now
enforces have been removed rather than restated: the prohibition on `sed` lives
in `no-sed-edit.ts`, not in prose.

## Extension: no-sed-edit.ts

Blocks `bash` calls that edit a file with `sed` — either in place (`sed -i`) or
by substituting into a redirect — and points at the `edit` tool instead. A rule
the model can read is a rule the model can rationalize past; this one is
enforced at the tool call.

Scope is deliberately narrow. It does not cover `awk`, `perl -i`, or other
rewrite tools.

## Reminder: read-fully.ts

Counts consecutive search operations — `rg`, `grep`, and the `grep` tool. Every
two in a row injects a reminder that searching is for locating files, and that
once a file is found it should be read start to finish. Partial reads miss
imports, types, control flow and helpers, which is exactly the context that
makes an edit correct.

Built on [pi-system-reminders](https://github.com/Michaelliv/pi-system-reminders).

## Prompts

Slash commands, loaded from `prompts/`.

| Command | Purpose |
|---------|---------|
| `/pristine` | Reread the code just written in full and ask whether it is clean, pristine, and worth being proud of. |
| `/reread` | Reread every changed file in full, review for correctness and clarity, fix what is not pristine, then rerun the verification gates. |
| `/taxonomy` | Audit for closed-set ownership drift — duplicated enums, parallel unions, rule sites that recreate knowledge owned elsewhere — and pin the repair with a test. |
| `/progressive-disclosure-descriptions-for-vex` | Check plugin action, table and field descriptions for progressive disclosure, as a Vex agent sees them. |

## Settings

| Setting | Value |
|---------|-------|
| Provider | `anthropic` |
| Model | `claude-fable-5` |
| Thinking | `medium` |
| Theme | `dark` |

## Packages

Most are local checkouts rather than published installs, so the source is
editable in place.

| Package | Source | What it does |
|---------|--------|-------------|
| [pi-websearch-router](https://github.com/Michaelliv/pi-websearch) | local | Web search with auto-detected provider |
| [pi-universal-view](https://github.com/Michaelliv/pi-universal-view) | local | Universal file viewer |
| [pi-system-reminders](https://github.com/Michaelliv/pi-system-reminders) | local | Reactive system reminders framework |
| [pi-ask-user-question](https://github.com/Michaelliv/pi-ask-user-question) | local | Interactive multi-choice question tool |
| [pi-runline](https://github.com/Michaelliv/runline) | local | Runline actions — Linear, Shift Cloud, and the rest of the plugin surface |
| [pi-recall](https://github.com/Michaelliv/pi-recall) | local | BM25 search across past pi conversations |
| pi-shift-mission-control | local, private | Read-only navigation of the Shift Cloud Vex fleet |
| [@shift-labs/pi-rlm](https://github.com/shift-labs-ai/pi-rlm) | npm | Replaces the tool surface with a single `execute` cell running real code |

## Install

```bash
# Install pi
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
# or: curl -fsSL https://pi.dev/install.sh | sh

# Clone this repo
git clone https://github.com/Michaelliv/dotpi.git
cd dotpi

# Copy the tracked config into place
mkdir -p ~/.pi/agent/extensions ~/.pi/agent/reminders ~/.pi/agent/prompts
cp AGENTS.md SYSTEM.md settings.json ~/.pi/agent/
cp extensions/no-sed-edit.ts ~/.pi/agent/extensions/
cp reminders/read-fully.ts ~/.pi/agent/reminders/
cp prompts/*.md ~/.pi/agent/prompts/
```

### Packages

`settings.json` refers to most packages by path relative to `~/.pi/agent`, which
resolves to `~/Projects`. Clone them there before starting pi, or edit the list
to match where they live.

```bash
mkdir -p ~/Projects && cd ~/Projects
git clone git@github.com:Michaelliv/pi-websearch.git
git clone git@github.com:Michaelliv/pi-universal-view.git
git clone git@github.com:Michaelliv/pi-system-reminders.git
git clone git@github.com:Michaelliv/pi-ask-user-question.git
git clone git@github.com:Michaelliv/runline.git
git clone git@github.com:Michaelliv/pi-recall.git
```

`pi-shift-mission-control` is private; clone it separately if you have access.

Runline is a Bun monorepo and loads plugins from built output, so it needs a
build before first use, plus a project root that is deliberately not tracked:

```bash
cd ~/Projects/runline && bun install && bun run build
echo "{\"project\":\"$HOME/Projects/runline\"}" > ~/.pi/agent/runline.json
```

The one npm-published package installs normally:

```bash
pi install npm:@shift-labs/pi-rlm
```

## License

MIT
