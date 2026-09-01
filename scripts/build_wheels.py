#!/usr/bin/env python3
"""Build platform-tagged PyPI wheels that ship the compiled `tm` binary.

This is the ruff/uv distribution pattern: each wheel contains no Python code,
just the native binary in the wheel's data/scripts directory, so pip installs
it straight onto the user's PATH. Run after `bun run scripts/build.ts`:

    python3 scripts/build_wheels.py

Wheels are written to dist/wheels/.
"""

from __future__ import annotations

import base64
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_NAME = "time-manager"  # existing PyPI project
PKG = "time_manager"  # normalized for filenames

# dist/bin directory -> (wheel platform tag, binary name)
TARGETS = {
    "timeman-linux-x64": ("manylinux_2_27_x86_64", "tm"),
    "timeman-linux-arm64": ("manylinux_2_27_aarch64", "tm"),
    "timeman-linux-x64-musl": ("musllinux_1_2_x86_64", "tm"),
    "timeman-linux-arm64-musl": ("musllinux_1_2_aarch64", "tm"),
    "timeman-darwin-x64": ("macosx_12_0_x86_64", "tm"),
    "timeman-darwin-arm64": ("macosx_12_0_arm64", "tm"),
    "timeman-windows-x64": ("win_amd64", "tm.exe"),
}

UNIX_WRAPPER = '#!/bin/sh\nexec "$(dirname "$0")/tm" "$@"\n'
WINDOWS_WRAPPER = '@echo off\r\n"%~dp0tm.exe" %*\r\n'


def record_line(path: str, data: bytes) -> str:
    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=")
    return f"{path},sha256={digest.decode()},{len(data)}"


def add_file(zf: zipfile.ZipFile, path: str, data: bytes, *, executable: bool) -> str:
    info = zipfile.ZipInfo(path, date_time=(2020, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (0o755 if executable else 0o644) << 16
    zf.writestr(info, data)
    return record_line(path, data)


def build_wheel(version: str, bin_dir: str, tag: str, exe: str, out_dir: Path) -> Path:
    binary = ROOT / "dist" / "bin" / bin_dir / exe
    readme = (ROOT / "README.md").read_text()

    metadata = "\n".join(
        [
            "Metadata-Version: 2.1",
            f"Name: {DIST_NAME}",
            f"Version: {version}",
            "Summary: A terminal based stopwatch and countdown timer",
            "Author: Rehan Haider",
            "License: MIT",
            "Project-URL: Repository, https://github.com/rehanhaider/time-manager",
            "Project-URL: Homepage, https://github.com/rehanhaider/time-manager#readme",
            "Keywords: timer,stopwatch,countdown,tui,terminal,cli",
            "Description-Content-Type: text/markdown",
            "",
            readme,
        ]
    ).encode()

    wheel_meta = "\n".join(
        [
            "Wheel-Version: 1.0",
            "Generator: build_wheels.py",
            "Root-Is-Purelib: false",
            f"Tag: py3-none-{tag}",
            "",
        ]
    ).encode()

    dist_info = f"{PKG}-{version}.dist-info"
    data_scripts = f"{PKG}-{version}.data/scripts"
    wheel_path = out_dir / f"{PKG}-{version}-py3-none-{tag}.whl"

    with zipfile.ZipFile(wheel_path, "w") as zf:
        records = [
            add_file(zf, f"{data_scripts}/{exe}", binary.read_bytes(), executable=True)
        ]
        # Long-form alias. Every channel ships exactly `tm` and `timeman`.
        if exe.endswith(".exe"):
            records.append(
                add_file(zf, f"{data_scripts}/timeman.cmd", WINDOWS_WRAPPER.encode(), executable=True)
            )
        else:
            records.append(
                add_file(zf, f"{data_scripts}/timeman", UNIX_WRAPPER.encode(), executable=True)
            )
        records.append(add_file(zf, f"{dist_info}/METADATA", metadata, executable=False))
        records.append(add_file(zf, f"{dist_info}/WHEEL", wheel_meta, executable=False))
        records.append(f"{dist_info}/RECORD,,")
        add_file(zf, f"{dist_info}/RECORD", ("\n".join(records) + "\n").encode(), executable=False)

    return wheel_path


def main() -> None:
    version = json.loads((ROOT / "package.json").read_text())["version"]
    out_dir = ROOT / "dist" / "wheels"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.whl"):
        old.unlink()

    built = 0
    for bin_dir, (tag, exe) in TARGETS.items():
        if not (ROOT / "dist" / "bin" / bin_dir / exe).exists():
            print(f"skip {bin_dir} (no binary)")
            continue
        wheel = build_wheel(version, bin_dir, tag, exe, out_dir)
        print(f"✓ {wheel.name} ({wheel.stat().st_size / 1048576:.1f} MB)")
        built += 1

    if built == 0:
        raise SystemExit("No binaries found — run `bun run scripts/build.ts` first.")
    print(f"\nBuilt {built} wheel(s) for {DIST_NAME} {version} in dist/wheels/")


if __name__ == "__main__":
    main()
