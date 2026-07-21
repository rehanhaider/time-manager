/**
 * Compile standalone `tm` binaries for every target (or a subset).
 *
 * Usage:
 *   bun run scripts/build.ts               # all targets
 *   bun run scripts/build.ts linux-x64 …   # only targets whose name contains an argument
 *
 * Requires native packages for all platforms:
 *   bun install --os="*" --cpu="*"
 */

import { rm } from "node:fs/promises"
import { TARGETS } from "./targets.ts"

// Bun < 1.3.14 silently mis-embeds OpenTUI's native assets in compiled
// executables (the TUI then crashes at startup with "loadedPath.startsWith").
const MIN_BUN = "1.3.14"
if (Bun.semver.order(Bun.version, MIN_BUN) < 0) {
  console.error(`Bun >= ${MIN_BUN} is required to build (found ${Bun.version}). Run: bun upgrade`)
  process.exit(1)
}

const filters = process.argv.slice(2)
const selected = filters.length
  ? TARGETS.filter((t) => filters.some((f) => t.npmPkg.includes(f)))
  : TARGETS

if (selected.length === 0) {
  console.error(`No targets match: ${filters.join(", ")}`)
  process.exit(1)
}

// Clear only what we are about to rebuild: a filtered build must leave the
// other platforms' binaries in place.
for (const target of selected) {
  await rm(`dist/bin/${target.npmPkg}`, { recursive: true, force: true })
}

for (const target of selected) {
  const outfile = `dist/bin/${target.npmPkg}/${target.exe}`
  console.log(`→ ${target.compile}`)
  const result = await Bun.build({
    entrypoints: ["src/index.ts"],
    compile: {
      target: target.compile as any,
      outfile,
    },
    // Embed only the matching libc branch of OpenTUI's native library.
    define: target.libc
      ? { "process.env.OPENTUI_LIBC": JSON.stringify(target.libc) }
      : {},
  })
  if (!result.success) {
    console.error(result.logs.join("\n"))
    process.exit(1)
  }
  const size = Bun.file(outfile).size
  console.log(`  ${outfile} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

console.log(`\nBuilt ${selected.length} target(s).`)
