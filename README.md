# timeman

A terminal based stopwatch and countdown timer, built with [OpenTUI](https://github.com/anomalyco/opentui) and shipped as standalone binaries — no runtime required.

- **CLI interface (default)**: Lightweight inline mode that lives in your scrollback.
- **TUI interface**: Full-screen terminal UI via `-i/--interactive`.
- **Notifications**: Bell + toast when a countdown completes.
- **Session timeline**: Stopwatch summary with per-session start/end times in your local time zone.
- **Drift-proof timing**: Durations use a monotonic clock, so a system clock jump (DST, NTP sync) never corrupts them.

![Stopwatch TUI Screenshot](./docs/stopwatch-tui.png)

## Installation

**curl** (Linux, macOS):

```bash
curl -fsSL https://raw.githubusercontent.com/rehanhaider/time-manager/main/install.sh | bash
```

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

All methods install the `tm` command, plus `timeman` (npm/bun/curl) or `time-manager` (pip) as an alias.

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

Keys: `space` start/stop · `r` reset · `q` quit.

On exit you get a session timeline — one bar per start/stop run, with total time:

```
╭──────────────── Project Alpha: 0 hrs 25 mins ────────────────╮
│   Session #1   13:53 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 14:03 IST  (0 hrs 10 mins) │
│                                                              │
│   Session #2   14:10 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 14:25 IST  (0 hrs 15 mins) │
╰──────────────────────────────────────────────────────────────╯
```

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
