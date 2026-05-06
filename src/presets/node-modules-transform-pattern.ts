import { readdirSync, readFileSync, realpathSync } from 'fs'
import path from 'path'

export interface NodeModulesTransformPatternOptions {
  mjs?: boolean
  scanPackageJson?: boolean
  scanNested?: boolean
  resolveSymlinks?: boolean
  extraPackages?: string[]
  cwd?: string
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g
const escapeRegex = (s: string): string => s.replace(REGEX_META, '\\$&')

interface ScanOptions {
  scanNested: boolean
  resolveSymlinks: boolean
}

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

function listPkgDirs(nodeModulesDir: string, resolveSymlinks: boolean): string[] {
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
  if (resolveSymlinks) {
    return dirs.map((d) => {
      try {
        return realpathSync(d)
      } catch {
        return d
      }
    })
  }

  return dirs
}

function scanForEsmPackages(cwd: string, opts: ScanOptions): string[] {
  const cacheKey = `${cwd}|${opts.scanNested}|${opts.resolveSymlinks}`
  const cached = scanCache.get(cacheKey)
  if (cached) return cached
  const found = new Set<string>()
  const topNm = path.join(cwd, 'node_modules')
  const topDirs = listPkgDirs(topNm, opts.resolveSymlinks)
  for (const dir of topDirs) {
    const name = readPkgType(dir)
    if (name) found.add(name)
    if (opts.scanNested) {
      const nestedNm = path.join(dir, 'node_modules')
      for (const nested of listPkgDirs(nestedNm, opts.resolveSymlinks)) {
        const nName = readPkgType(nested)
        if (nName) found.add(nName)
      }
    }
  }
  const result = [...found]
  scanCache.set(cacheKey, result)

  return result
}

/** @internal */
export function __resetScanCacheForTesting(): void {
  scanCache.clear()
}

/**
 * Build a `transformIgnorePatterns` entry that ignores `node_modules` except for
 * ESM-related files. Use with the `JsWithTs` presets when you need ESM packages
 * inside `node_modules` to be transformed by ts-jest.
 *
 * @example
 * // Basic: only exempt .mjs files
 * transformIgnorePatterns: [nodeModulesTransformPattern()]
 *
 * @example
 * // Auto-detect "type":"module" packages, including pnpm
 * transformIgnorePatterns: [
 *   nodeModulesTransformPattern({
 *     scanPackageJson: true,
 *     scanNested: true,
 *     resolveSymlinks: true,
 *   }),
 * ]
 *
 * @param options.mjs - Exempt `*.mjs` files. Default `true`.
 * @param options.scanPackageJson - Scan `node_modules` and exempt packages whose
 *   `package.json` declares `"type": "module"`. Default `false`.
 * @param options.scanNested - When scanning, recurse one level into
 *   `node_modules/<pkg>/node_modules`. Default `false`.
 * @param options.resolveSymlinks - When scanning, follow symlinks (needed for
 *   pnpm's `.pnpm/` layout). Default `false`.
 * @param options.extraPackages - Additional package names to exempt. Default `[]`.
 * @param options.cwd - Directory to scan from. Default `process.cwd()`.
 * @returns A regex string suitable for `transformIgnorePatterns`.
 */
export function nodeModulesTransformPattern(options: NodeModulesTransformPatternOptions = {}): string {
  const {
    mjs = true,
    scanPackageJson = false,
    scanNested = false,
    resolveSymlinks = false,
    extraPackages = [],
    cwd = process.cwd(),
  } = options
  const exempts = new Set<string>(extraPackages)
  if (scanPackageJson) {
    for (const name of scanForEsmPackages(cwd, { scanNested, resolveSymlinks })) {
      exempts.add(name)
    }
  }
  const escapedExempts = [...exempts].map(escapeRegex)
  const exemptPattern = escapedExempts.join('|')
  const pkgGroup = exempts.size ? `(?!(?:(?:${exemptPattern})(?:/|$)|.*/node_modules/(?:${exemptPattern})(?:/|$)))` : ''
  const mjsGroup = mjs ? '(?!.*\\.mjs$)' : ''
  if (!pkgGroup && !mjsGroup) return '/node_modules/'

  return `/node_modules/${pkgGroup}${mjsGroup}`
}
