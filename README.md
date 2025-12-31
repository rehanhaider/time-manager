# Timer CLI

A powerful and visually stunning terminal-based timer application built with [Textual](https://textual.textualize.io/) and [Typer](https://typer.tiangolo.com/).

- **TUI Interface**: Beautiful, responsive terminal user interface with a premium feel.
- **Notifications**: Visual and audio feedback (bell) when a countdown completes.

## Features

- **Stopwatch**: Precise stopwatch with centisecond resolution.
- **Countdown**: Configurable countdown timer with support for seconds, minutes, and hours.

## Installation

### Prerequisites

- [uv](https://github.com/astral-sh/uv) installed on your system.

### Global Installation (Recommended)

To install `timer` as a system-wide utility:

```bash
make global
```

This builds a standalone executable and copies it to `/usr/local/bin/timer`, making it available from anywhere.

### Local Development

To install in editable mode for development:

```bash
make local
```

## Usage

### Stopwatch

Start a stopwatch to track elapsed time:

```bash
timer sw
```

For CLI mode (non-interactive):

```bash
timer sw --cli
```

**Controls (TUI mode):**
- `Space`: Start/Stop
- `r`: Reset
- `q`: Quit

### Countdown Timer

Start a countdown for a specific duration:

```bash
timer cd 5 m    # 5 minutes
timer cd 60 s   # 60 seconds
timer cd 1 h    # 1 hour
```

For CLI mode (non-interactive):

```bash
timer cd 5 m --cli
```

**Controls (TUI mode):**
- `Space`: Pause/Resume
- `q`: Quit

## Development

### Make Commands

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `make local`           | Install in editable mode for development          |
| `make global`          | Build and install system-wide to `/usr/local/bin` |
| `make build`           | Build standalone executable (with version bump)   |
| `make bump`            | Bump patch version (default)                      |
| `TYPE=MINOR make bump` | Bump minor version                                |
| `TYPE=MAJOR make bump` | Bump major version                                |
| `make clean`           | Remove build artifacts                            |
| `make uninstall`       | Remove global installation                        |

### Project Structure

```
timer/
├── src/
│   ├── app.py              # CLI entry point using Typer
│   ├── cli/
│   │   ├── __init__.py     # CLI package exports
│   │   └── cli.py          # CLI implementations for timers
│   ├── core/
│   │   ├── formatting.py   # Time formatting utilities
│   │   └── timer.py        # Core timer logic
│   └── tui/
│       ├── __init__.py     # TUI package exports
│       ├── countdown.py    # Countdown TUI
│       ├── stopwatch.py    # Stopwatch TUI
│       └── theme.tcss      # Textual CSS theme
├── scripts/
│   └── bump.sh             # Version bump script
├── pyproject.toml          # Project configuration
├── timer.spec              # PyInstaller specification
├── uv.lock                 # Dependency lock file
├── Makefile                # Build and install commands
├── LICENSE                 # Project license
└── README.md               # This file
```

## Uninstallation

To remove the global installation:

```bash
make uninstall
```
