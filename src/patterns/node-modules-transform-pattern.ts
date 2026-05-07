import { readdirSync, readFileSync } from 'fs'
import path from 'path'

export interface NodeModulesTransformPatternOptions {
  scanPackageJson?: boolean
  extraPackages?: string[]
  cwd?: string
  mjs?: boolean
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g
const escapeRegex = (s: string): string => s.replace(REGEX_META, '\\$&')

const scanCache = new Map<string, string[]>()

function readPkgType(pkgDir: string): string | null {
  try {
    const raw = readFileSync(path.join(pkgDir, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw) as { type?: string; name?: string }

    return parsed.type === 'module' ? parsed.name ?? null : null
  } catch {
    return null
  }
}

function listPkgDirs(nodeModulesDir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(nodeModulesDir)
  } catch {
    return []
  }
  const dirs: string[] = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const full = path.join(nodeModulesDir, entry)
    if (entry.startsWith('@')) {
      let scoped: string[] = []
      try {
        scoped = readdirSync(full)
      } catch {
        continue
      }
      for (const sub of scoped) dirs.push(path.join(full, sub))
    } else {
      dirs.push(full)
    }
  }

  return dirs
}

function scanForEsmPackages(cwd: string): string[] {
  const cached = scanCache.get(cwd)
  if (cached) return cached
  const found = new Set<string>()
  const topNm = path.join(cwd, 'node_modules')
  for (const dir of listPkgDirs(topNm)) {
    const name = readPkgType(dir)
    if (name) found.add(name)
  }
  const result = [...found]
  scanCache.set(cwd, result)

  return result
}

/** @internal */
export function resetScanCacheForTesting(): void {
  scanCache.clear()
}

/**
 * Build a `transformIgnorePatterns` entry that ignores `node_modules` except for
 * the specified packages and/or `.mjs` files. Use with the `JsWithTs` presets when
 * you need ESM packages or `.mjs` files inside `node_modules` to be transformed by ts-jest.
 *
 * @example
 * transformIgnorePatterns: [
 *   nodeModulesTransformPattern({ scanPackageJson: true }),
 * ]
 *
 * @param options.scanPackageJson - Scan `node_modules` and exempt packages whose
 *   `package.json` declares `"type": "module"`. Default `false`.
 * @param options.extraPackages - Additional package names to exempt. Default `[]`.
 * @param options.cwd - Directory to scan from. Default `process.cwd()`.
 * @param options.mjs - Exempt all `.mjs` files in `node_modules`. Pair with
 *   `mjsNodeModules: true` in the preset so Jest routes those files to ts-jest.
 *   Default `false`.
 * @returns A regex string suitable for `transformIgnorePatterns`.
 */
export function nodeModulesTransformPattern(options: NodeModulesTransformPatternOptions = {}): string {
  const { scanPackageJson = false, extraPackages = [], cwd = process.cwd(), mjs = false } = options
  const exempts = new Set<string>(extraPackages)
  if (scanPackageJson) {
    for (const name of scanForEsmPackages(cwd)) {
      exempts.add(name)
    }
  }

  const alternatives: string[] = []
  if (exempts.size > 0) {
    const exemptPattern = [...exempts].map(escapeRegex).join('|')
    alternatives.push(`(?:${exemptPattern})(?:/|$)`)
    alternatives.push(`.*/node_modules/(?:${exemptPattern})(?:/|$)`)
  }
  if (mjs) {
    alternatives.push(`.*\\.mjs$`)
  }

  if (alternatives.length === 0) return '/node_modules/'

  return `/node_modules/(?!(?:${alternatives.join('|')}))`
}
