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
```

Run `openwhispr <command> --help` for full flags.

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

**jordan.lee@example.com** *(15:32:18)*: Hi, pleasure to meet you...

**Me** *(15:33:23)*: I'm Sam. I lead the product team...
```
