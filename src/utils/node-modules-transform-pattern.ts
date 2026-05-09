import type { NodeModulesTransformOptions } from '../types'

import { findTypeModulePackages } from './find-type-module-packages'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a `transformIgnorePatterns` entry that ignores `node_modules` except for
 * packages whose `package.json` declares `"type": "module"`. Use with the `JsWithTs`
 * presets when you need ESM packages inside `node_modules` to be transformed by ts-jest.
 *
 * @param options.typeModulePackages - Scan `node_modules` and exempt packages whose
 *   `package.json` declares `"type": "module"`. Default `false`.
 * @param options.packageNames - Additional package names to exempt. Default `[]`.
 * @param options.nodeModulesPath - Directory to scan from. Default `process.cwd()`.
 * @returns A regex string suitable for `transformIgnorePatterns`.
 */
export function nodeModulesTransformPattern({
  typeModulePackages = false,
  packageNames = [],
  nodeModulesPath = process.cwd(),
}: NodeModulesTransformOptions = {}): string {
  const allPackages = new Set<string>(packageNames)
  if (typeModulePackages) {
    for (const name of findTypeModulePackages(nodeModulesPath)) {
      allPackages.add(name)
    }
  }
  if (!allPackages.size) return '/node_modules/'

  const escaped = [...allPackages].map(escapeRegex).join('|')

  return `/node_modules/(?!(${escaped})/)`
}
