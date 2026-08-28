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
openwhispr transcribe <absolute-audio-path> [--wait] [--format json|text]
```

Run `openwhispr <command> --help` for full flags.

### Local-only file transcription (POC)

`openwhispr transcribe <path>` submits an absolute local audio file path to the
desktop app's local bridge, which runs it through your already-configured
local model/engine (Whisper or Parakeet) exactly as the desktop app's own
"Upload audio" flow does. It only ever talks to the local bridge — there is no
`--remote` mode for this command, and no cloud fallback. Audio bytes are never
sent over the network; only the path is submitted, and the bridge validates
it is absolute, exists, and looks like an audio file before queuing it.

```sh
# Queue the job and print its id/status immediately
openwhispr transcribe /Users/me/audio.wav

# Block until done, then print just the transcript text
openwhispr transcribe /Users/me/audio.wav --wait

# Block until done, then print the full job JSON (result, timings, etc.)
openwhispr transcribe /Users/me/audio.wav --wait --format json
```

This is a proof-of-concept pathway: jobs are single-concurrency and kept
in-memory by the desktop app, so they do not survive a desktop app restart,
and results are not written to a note or the transcriptions database — this
command is the only way to retrieve the transcript.

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

**jordan.lee@example.com** *(15:32:18)*: Hi, pleasure to meet you...

**Me** *(15:33:23)*: I'm Sam. I lead the product team...
```
