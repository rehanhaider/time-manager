/**
 * Assemble distribution artifacts from the binaries in dist/bin:
 *  - dist/npm/timeman            main npm package (Node shim + optionalDependencies)
 *  - dist/npm/timeman-<platform> per-platform npm packages containing the binary
 *  - dist/release/*.tar.gz|zip   GitHub release artifacts (curl installer channel)
 *
 * Run after: bun run scripts/build.ts
 */

import { cp, mkdir, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { $ } from "bun"
import { TARGETS, projectVersion } from "./targets.ts"

const version = await projectVersion()
const repository = { type: "git", url: "git+https://github.com/rehanhaider/time-manager.git" }
const description = "A terminal based stopwatch and countdown timer"

await rm("dist/npm", { recursive: true, force: true })
await rm("dist/release", { recursive: true, force: true })
await mkdir("dist/release", { recursive: true })

const built = TARGETS.filter((t) => existsSync(`dist/bin/${t.npmPkg}/${t.exe}`))
if (built.length === 0) {
  console.error("No binaries found in dist/bin — run `bun run scripts/build.ts` first.")
  process.exit(1)
}
if (built.length < TARGETS.length) {
  const missing = TARGETS.filter((t) => !built.includes(t)).map((t) => t.npmPkg)
  console.warn(`WARNING: packaging only ${built.length}/${TARGETS.length} targets (missing: ${missing.join(", ")})`)
}

// Per-platform npm packages + release artifacts
for (const target of built) {
  const pkgDir = `dist/npm/${target.npmPkg}`
  await mkdir(`${pkgDir}/bin`, { recursive: true })
  await cp(`dist/bin/${target.npmPkg}/${target.exe}`, `${pkgDir}/bin/${target.exe}`)
  await Bun.write(
    `${pkgDir}/package.json`,
    JSON.stringify(
      {
        name: target.npmPkg,
        version,
        description: `${description} (${target.os}-${target.cpu}${target.libc === "musl" ? "-musl" : ""} binary)`,
        license: "MIT",
        repository,
        os: [target.os],
        cpu: [target.cpu],
        ...(target.libc ? { libc: [target.libc] } : {}),
        files: ["bin"],
      },
      null,
      2,
    ) + "\n",
  )

  if (target.exe.endsWith(".exe")) {
    await $`zip -j -q dist/release/${target.artifact}.zip dist/bin/${target.npmPkg}/${target.exe}`
  } else {
    await $`tar -czf dist/release/${target.artifact}.tar.gz -C dist/bin/${target.npmPkg} ${target.exe}`
  }
  console.log(`✓ ${target.npmPkg}`)
}

// Main package with the launcher shim
const mainDir = "dist/npm/timeman-cli"
await mkdir(`${mainDir}/bin`, { recursive: true })

const optionalDependencies = Object.fromEntries(built.map((t) => [t.npmPkg, version]))

await Bun.write(
  `${mainDir}/package.json`,
  JSON.stringify(
    {
      name: "timeman-cli",
      version,
      description,
      license: "MIT",
      repository,
      homepage: "https://github.com/rehanhaider/time-manager#readme",
      keywords: ["timer", "stopwatch", "countdown", "tui", "terminal", "cli", "pomodoro"],
      bin: { tm: "bin/tm.cjs", timeman: "bin/tm.cjs" },
      files: ["bin"],
      optionalDependencies,
    },
    null,
    2,
  ) + "\n",
)

const shim = `#!/usr/bin/env node
"use strict"
// Launcher for the platform-specific timeman binary (installed via optionalDependencies).
const { spawnSync } = require("child_process")

function isMusl() {
  if (process.platform !== "linux") return false
  try {
    const report = process.report && process.report.getReport()
    if (report && report.header) return !report.header.glibcVersionRuntime
  } catch {}
  return false
}

const suffix = process.platform === "linux" && isMusl() ? "-musl" : ""
const platformName = process.platform === "win32" ? "windows" : process.platform
const pkg = "timeman-" + platformName + "-" + process.arch + suffix
const exe = process.platform === "win32" ? "tm.exe" : "tm"

let binPath
try {
  binPath = require.resolve(pkg + "/bin/" + exe)
} catch {
  console.error(
    'timeman: could not find the native binary package "' + pkg + '".\\n' +
      "Either your platform (" + process.platform + "-" + process.arch + suffix + ") is unsupported,\\n" +
      "or optional dependencies were skipped during install. Try reinstalling:\\n\\n" +
      "  npm install -g timeman --force\\n",
  )
  process.exit(1)
}

const result = spawnSync(binPath, process.argv.slice(2), { stdio: "inherit" })
if (result.error) {
  console.error("timeman: " + result.error.message)
  process.exit(1)
}
if (result.signal) {
  process.kill(process.pid, result.signal)
}
process.exit(result.status === null ? 1 : result.status)
`
await Bun.write(`${mainDir}/bin/tm.cjs`, shim)

for (const file of ["README.md", "LICENSE"]) {
  if (existsSync(file)) await cp(file, `${mainDir}/${file}`)
}

// Checksums for the release artifacts
await $`sh -c 'cd dist/release && sha256sum * > sha256sums.txt'`

console.log(`✓ timeman-cli (main package, ${built.length} platform deps)`)
console.log(`\nPackaged version ${version}: dist/npm/ + dist/release/`)
