# time-manager

A powerful and visually stunning terminal-based timer application built with [Textual](https://textual.textualize.io/) and [Typer](https://typer.tiangolo.com/).

- **CLI Interface (default)**: Lightweight mode (no Textual UI).
- **TUI Interface**: Beautiful, responsive terminal user interface via `-i/--interactive`.
- **Notifications**: Visual and audio feedback (bell) when a countdown completes.

![Stopwatch TUI Screenshot](./docs/stopwatch-tui.png)

## Features

- **Stopwatch**: Precise stopwatch with centisecond resolution.
- **Countdown**: Configurable countdown timer with support for seconds, minutes, and hours.

## Installation

- Requires **Python 3.10+**
- Installs two commands: `tm` (recommended) and `time-manager`

From PyPI:

```bash
pip install time-manager
```

If you use uv:

```bash
uv tool install time-manager

# or (inside a project)
uv add time-manager
```

## Usage

time-manager provides two command names for convenience:

- `tm` - Short and convenient alias
- `time-manager` - Full command name

Both commands work identically. Examples:

```bash
tm sw              # or: time-manager sw   (also: tm stopwatch)
tm cd 5 m          # or: time-manager cd 5 m (also: tm countdown 5 m)
```

### Stopwatch

Start a stopwatch to track elapsed time:

```bash
tm sw
tm sw -n "Project Alpha"
```

For interactive TUI mode:

```bash
tm sw -i
tm sw -i -n "Project Alpha"
```

**Controls (TUI mode):**
- `Space`: Start/Stop
- `r`: Reset
- `q`: Quit

### Countdown Timer

Start a countdown for a specific duration:

```bash
tm cd 5 m    # 5 minutes
tm cd 60 s   # 60 seconds
tm cd 1 h    # 1 hour
```

For interactive TUI mode:

```bash
tm cd 5 m -i
```

**Controls (TUI mode):**
- `Space`: Pause/Resume
- `q`: Quit

## Development

### Prerequisites

- [uv](https://github.com/astral-sh/uv) installed on your system.
- Python 3.10+

### Installation for Development

To install in editable mode for development:

```bash
make local
```

### Global Installation (Recommended for Testing)

To install as a system-wide utility:

```bash
make global
```

This builds a standalone executable and copies it to `/usr/local/bin/time-manager`, and also creates a `/usr/local/bin/tm` symlink.

### Make Commands

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `make run`             | Run the application                               |
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
time-manager/
├── src/
│   ├── app.py              # CLI entry point using Typer
│   ├── cli/
│   │   ├── __init__.py     # CLI package exports
│   │   └── cli.py          # CLI implementations for timers
│   ├── core/
│   │   ├── formatting.py   # Time formatting utilities
│   │   └── termclock.py    # Core timer logic
│   └── tui/
│       ├── __init__.py     # TUI package exports
│       ├── countdown.py    # Countdown TUI
│       ├── stopwatch.py    # Stopwatch TUI
│       └── theme.tcss      # Textual CSS theme
├── scripts/
│   └── bump.sh             # Version bump script
├── pyproject.toml          # Project configuration
├── uv.lock                 # Dependency lock file
├── Makefile                # Build and install commands
├── LICENSE                 # Project license
└── README.md               # This file
```

### Publishing to PyPI

This repo uses `make publish` (via `scripts/publish.sh`) and defaults to **TestPyPI**.

#### Test PyPI (default)

To publish to Test PyPI (uses `TEST_PYPI_PUBLISH_TOKEN`):

```bash
make build
make publish
```

#### Production PyPI

To publish to production PyPI (uses `PYPI_PUBLISH_TOKEN`):

```bash
make build
PROD=TRUE make publish
```

### Uninstallation

To remove the global installation:

```bash
make uninstall
```
