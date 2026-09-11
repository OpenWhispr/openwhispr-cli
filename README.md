# @openwhispr/cli

The unified `openwhispr` command-line tool. Works against either the local
desktop app (via a loopback HTTP bridge) or the cloud REST API, with
auto-detection.

## Install

```sh
npm i -g @openwhispr/cli
```

Requires Node.js >= 20.

## Quick start

```sh
# If the desktop app is running, this just works:
openwhispr notes list

# Otherwise, configure remote access:
openwhispr auth login            # paste an owk_live_... API key
openwhispr notes list

# Diagnose connectivity to both backends:
openwhispr doctor
```

## Backend selection

The CLI picks a backend in this order:

1. Explicit flag: `--local` or `--remote`
2. Env var: `OPENWHISPR_BACKEND=auto|local|remote`
3. Config file: `~/.openwhispr/cli-config.json` → `backend`
4. Auto (default): try local first, fall back to remote, fail if neither
   is configured

## Files

- `~/.openwhispr/cli-config.json` (mode `0600`) — CLI config plus API key
- `~/.openwhispr/cli-bridge.json` (mode `0600`, written by the desktop app)
  — port + bearer token for the local bridge

## Compatibility matrix

| CLI version | Min desktop version | Min API version |
| ----------- | ------------------- | --------------- |
| 0.1.x       | TBD                 | TBD             |

The desktop bridge contract is versioned at `/v1/`. Breaking changes ship
under a new major version.

## Exit codes

| Code | Meaning                             |
| ---- | ----------------------------------- |
| 0    | Success                             |
| 1    | User error (bad args, missing flag) |
| 2    | Backend unreachable                 |
| 3    | Auth failure                        |
| 4    | Not found                           |
| 5    | Safety gate refused                 |

## Command surface

```
openwhispr doctor
openwhispr version

openwhispr auth login | logout | status
openwhispr config get | set <key> <value>

openwhispr notes list | get | create | update | delete | search
openwhispr folders list | create
openwhispr transcriptions list | get | delete
openwhispr audio delete <transcription-id>
openwhispr dictionary list | add <word...> | remove <word...>
openwhispr snippets list | add <trigger> <replacement> | remove <trigger...>
openwhispr transcribe <file> [--model <id>] [--language <code>] [--prompt <text>]
                             [--format text|json] [--note] [--title <t>] [--folder <name>]
```

Run `openwhispr <command> --help` for full flags.

### Dictionary and snippets

The dictionary is a list of words (names, jargon, acronyms) that biases
transcription toward the spelling you want. Snippets expand a spoken trigger
phrase into saved text. Both commands work against the running desktop app or
the cloud API; remote API keys need the `dictionary:read`/`dictionary:write` and
`snippets:read`/`snippets:write` scopes.

### Transcribing audio files

`openwhispr transcribe <file>` turns an audio file into text. With the desktop
app running it uses the app's local models: free, on-device, no size limit.
`--model` picks a downloaded model by name (e.g. `base`); a rejected model
prints the available ones. Add `--remote` to use OpenWhispr Cloud instead,
which requires a Pro or Business plan and an API key with the
`transcriptions:write` scope. `--prompt` is cloud only; `--model` is local only.

```sh
openwhispr transcribe meeting.m4a                       # local, prints the transcript
openwhispr transcribe meeting.m4a --format json         # text plus provider, model, duration
openwhispr transcribe meeting.m4a --note --folder Work  # save as a note (folder by name)
openwhispr transcribe meeting.m4a --remote --prompt "Names: Ada, Linus"
```

**Cloud transcription is in beta** and its limits may change. Each request is
capped at 4 MB, so larger files are split into 4-minute chunks with `ffmpeg`
(must be on your `PATH`), uploaded one at a time, and the transcripts joined.
Cloud minutes are limited to 600 per month per account. The audio is uploaded;
the file's path on your machine is not.

### Enhanced notes

For notes with an AI-enhanced version (e.g. meeting notes), `notes get`'s
markdown output shows the enhanced note when one exists, matching the desktop
app. The raw fields are always available via `--format json` (`content`,
`enhanced_content`).

### Fetching just the transcript

`openwhispr notes get <id>` returns the whole note payload. To pull only the
transcript, pass `--transcript`:

```sh
# Transcript as JSON: { "transcript": "..." }
openwhispr notes get <id> --transcript --format json

# Transcript as a clean, speaker-labeled markdown blob
openwhispr notes get <id> --transcript --format markdown
```

The markdown output parses the transcript into a readable, copy-paste-ready
document — a `## Transcript` section with one line per segment, each timestamped
and labeled with the speaker: `Me` for your own mic, otherwise the segment's
`speakerName` when available, falling back to the diarized id (`speaker_0` →
`Speaker 1`, matching the desktop app):

```markdown
# Meeting name

## Transcript

**jordan.lee@example.com** _(15:32:18)_: Hi, pleasure to meet you...

**Me** _(15:33:23)_: I'm Sam. I lead the product team...
```
