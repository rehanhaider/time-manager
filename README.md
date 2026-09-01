# timeman

[![npm](https://img.shields.io/npm/v/timeman-cli?label=npm)](https://www.npmjs.com/package/timeman-cli)
[![PyPI](https://img.shields.io/pypi/v/time-manager?label=pypi)](https://pypi.org/project/time-manager/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A terminal based stopwatch and countdown timer, built with [OpenTUI](https://github.com/anomalyco/opentui) and shipped as standalone binaries — no runtime required.

- **CLI interface (default)**: Lightweight inline mode that lives in your scrollback.
- **TUI interface**: Full-screen terminal UI via `-i/--interactive`.
- **Notifications**: Bell + toast when a countdown completes.
- **Session timeline**: Stopwatch summary with per-session start/end times in your local time zone.
- **Session history**: Every stopwatch session is saved. Review, delete and retitle them from the TUI with `h`.
- **Drift-proof timing**: Durations use a monotonic clock, so a system clock jump (DST, NTP sync) never corrupts them.

![Stopwatch TUI Screenshot](./docs/stopwatch-tui.png)

## Installation

**npm**:

```bash
npm install -g timeman-cli
```

**bun**:

```bash
bun add -g timeman-cli
```

**pip / uv** (same binary, published as [time-manager](https://pypi.org/project/time-manager/) for continuity with the original Python package):

```bash
pip install time-manager
# or
uv tool install time-manager
```

**curl** (Linux, macOS — downloads the binary from the latest GitHub release):

```bash
curl -fsSL https://raw.githubusercontent.com/rehanhaider/time-manager/main/install.sh | bash
```

Every method installs the same two commands, `tm` and its long form `timeman`, pointing at one binary. Package names differ by registry for historical reasons: `timeman-cli` on npm, `time-manager` on PyPI.

Supported platforms: Linux x64/arm64 (glibc and musl), macOS x64/arm64, Windows x64 (via npm/bun).

## Usage

```bash
tm sw              # stopwatch            (also: tm stopwatch)
tm cd 5 m          # 5-minute countdown   (also: tm countdown 5 m)
```

### Stopwatch

```bash
tm sw
tm sw -p "Project Alpha"   # name the session for the summary
tm sw -i                   # full-screen TUI
```

Keys: `space` start/stop · `r` reset · `q` quit · `h` history (TUI only).

On exit you get a session timeline — one bar per start/stop run, with total time:

```
╭──────────────── Project Alpha: 0 hrs 25 mins ────────────────╮
│   Session #1   13:53 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 14:03 IST  (0 hrs 10 mins) │
│                                                              │
│   Session #2   14:10 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 14:25 IST  (0 hrs 15 mins) │
╰──────────────────────────────────────────────────────────────╯
```

### Session history

Both modes save every session when you quit. Only the TUI reads them back, so press `h` from `tm sw -i`. There is no `tm log` command.

The first screen rolls your projects up over a billing period, largest first:

```
       This Week    This Month    Last Month    All Time

             August 2026  ·  11 hrs 52 mins logged

╭────────────────────────────────────────────────────────────────────────╮
│   PROJECT                SHARE                           TOTAL    LAST │
│                                                                        │
│  ▸Project Alpha          ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬    4 hrs 10 mins     Sun │
│   Client Review          ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬     4 hrs 5 mins     Mon │
│   Deep Work              ▬▬▬▬▬▬▬▬▬▬▬▬▬           2 hrs 47 mins     Sat │
│   Untitled               ▬▬▬▬                    0 hrs 50 mins     Fri │
╰────────────────────────────────────────────────────────────────────────╯
```

Keys: `↑↓` project · `←→` period · `enter` line items · `esc` back · `q` quit.

`enter` breaks one project into invoice lines, one per day, with its sessions underneath:

```
              Client Review  ·  Last Month  ·  4 hrs 5 mins

╭────────────────────────────────────────────────────────────────────────╮
│   Mon 31 Aug ─────────────────────────────────────────   2 hrs 25 mins │
│  ▸  13:15 → 15:40                                        2 hrs 25 mins │
│                                                                        │
│   Thu 27 Aug ─────────────────────────────────────────    1 hr 40 mins │
│     10:00 → 11:40                                         1 hr 40 mins │
╰────────────────────────────────────────────────────────────────────────╯
```

Keys: `↑↓` session · `d` delete · `r` rename the project · `esc` back · `q` quit.

A row shows the wall-clock span alongside the time actually on the clock. Pause mid-session and the duration comes out shorter than the span. `d` asks for `y`/`n` on the row itself. `r` retitles every session filed under that project, which is how `Untitled` gets fixed after you forget `-p`.

Sessions live in a SQLite database at `~/.local/share/timeman/history.db`, or `~/Library/Application Support/timeman` on macOS and `%LOCALAPPDATA%\timeman` on Windows. `TIMEMAN_HOME` overrides that directory. The newest 5,000 sessions are kept.

### Countdown

```bash
tm cd 90 s         # units: s/sec/seconds, m/min/minutes, h/hr/hours
tm cd 5            # unit defaults to minutes
tm cd 1 h -i       # full-screen TUI
```

Keys: `space` pause/resume · `q` quit. The display turns yellow under 30 seconds and red under 10; when time is up you get a terminal bell and a toast.

## Development

Requires [Bun](https://bun.sh) >= 1.3.14.

```bash
bun install                      # install dependencies
bun run dev sw                   # run from source
bun test                         # tests
bunx tsc --noEmit                # typecheck
```

Building distribution artifacts:

```bash
bun install --os="*" --cpu="*"   # stage native packages for every platform (one-time)
make build                       # compile binaries for all 7 targets into dist/bin
make package                     # assemble npm packages (dist/npm) + release tarballs (dist/release)
```

## Releasing

Everything publishes locally from this machine — no CI, no secrets on GitHub.

1. `make bump` (or `TYPE=minor make bump`), commit.
2. `make package` — builds all binaries, npm packages, wheels, and release tarballs.
3. `make publish` — rehearsal: npm `--dry-run` + TestPyPI.
4. `PROD=TRUE make publish` — the real thing: npm packages, PyPI wheels, and a GitHub release `v<version>` with the binaries (which the curl installer downloads).

Credentials: npm token in `~/.npmrc`, PyPI tokens in `.env` (`PYPI_PUBLISH_TOKEN`, `TEST_PYPI_PUBLISH_TOKEN`), and an authenticated `gh` CLI for the release upload.

## History

This project was originally written in Python with Textual and published to PyPI as [time-manager](https://pypi.org/project/time-manager/) (last Python release: 0.3.1; the implementation is preserved in git history). From 0.4.0 on, the PyPI package ships the same compiled binary as the npm package — `pip install time-manager` keeps working with no Python runtime involved.

## License

MIT
