/** Build matrix shared by build.ts and package.ts. */

export interface Target {
  /** Bun compile target. */
  compile: string
  /** npm platform package name (also the dist/bin subdirectory). */
  npmPkg: string
  /** GitHub release artifact base name (curl channel). */
  artifact: string
  /** package.json os/cpu/libc gates. */
  os: string
  cpu: string
  libc?: "glibc" | "musl"
  /** Binary file name inside the package. */
  exe: string
}

export const TARGETS: Target[] = [
  { compile: "bun-linux-x64", npmPkg: "timeman-linux-x64", artifact: "tm-linux-x64", os: "linux", cpu: "x64", libc: "glibc", exe: "tm" },
  { compile: "bun-linux-arm64", npmPkg: "timeman-linux-arm64", artifact: "tm-linux-arm64", os: "linux", cpu: "arm64", libc: "glibc", exe: "tm" },
  { compile: "bun-linux-x64-musl", npmPkg: "timeman-linux-x64-musl", artifact: "tm-linux-x64-musl", os: "linux", cpu: "x64", libc: "musl", exe: "tm" },
  { compile: "bun-linux-arm64-musl", npmPkg: "timeman-linux-arm64-musl", artifact: "tm-linux-arm64-musl", os: "linux", cpu: "arm64", libc: "musl", exe: "tm" },
  { compile: "bun-darwin-x64", npmPkg: "timeman-darwin-x64", artifact: "tm-darwin-x64", os: "darwin", cpu: "x64", exe: "tm" },
  { compile: "bun-darwin-arm64", npmPkg: "timeman-darwin-arm64", artifact: "tm-darwin-arm64", os: "darwin", cpu: "arm64", exe: "tm" },
  { compile: "bun-windows-x64", npmPkg: "timeman-win32-x64", artifact: "tm-win32-x64", os: "win32", cpu: "x64", exe: "tm.exe" },
]

export async function projectVersion(): Promise<string> {
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json()
  return pkg.version as string
}
