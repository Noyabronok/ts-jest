import * as fs from 'fs'
import path from 'path'

import { nodeModulesTransformPattern, __resetScanCacheForTesting } from './node-modules-transform-pattern'

describe('nodeModulesTransformPattern', () => {
  const FIXTURE = path.join(__dirname, '__test-fixtures__')

  beforeEach(() => {
    __resetScanCacheForTesting()
  })

  describe('mjs flag', () => {
    it('exempts .mjs by default', () => {
      const pattern = nodeModulesTransformPattern()
      const re = new RegExp(pattern)
      expect(re.test('/repo/node_modules/foo/index.js')).toBe(true) // ignored
      expect(re.test('/repo/node_modules/foo/index.mjs')).toBe(false) // transformed
    })

    it('returns plain /node_modules/ when mjs disabled and no other exemptions', () => {
      expect(nodeModulesTransformPattern({ mjs: false })).toBe('/node_modules/')
    })
  })

  describe('extraPackages', () => {
    it('exempts named extras', () => {
      const re = new RegExp(nodeModulesTransformPattern({ extraPackages: ['esm-pkg'] }))
      expect(re.test('/repo/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/repo/node_modules/cjs-pkg/index.js')).toBe(true)
    })

    it('escapes regex meta characters in package names', () => {
      const re = new RegExp(nodeModulesTransformPattern({ extraPackages: ['@scope/dot.pkg'] }))
      expect(re.test('/repo/node_modules/@scope/dot.pkg/index.js')).toBe(false)
      expect(re.test('/repo/node_modules/@scope/dotXpkg/index.js')).toBe(true)
    })

    it('combines mjs and extraPackages', () => {
      const re = new RegExp(nodeModulesTransformPattern({ extraPackages: ['esm-pkg'] }))
      expect(re.test('/repo/node_modules/foo/index.mjs')).toBe(false)
      expect(re.test('/repo/node_modules/esm-pkg/sub.js')).toBe(false)
      expect(re.test('/repo/node_modules/foo/index.js')).toBe(true)
    })
  })

  describe('scanPackageJson', () => {
    it('finds top-level "type":"module" packages', () => {
      const re = new RegExp(nodeModulesTransformPattern({ scanPackageJson: true, mjs: false, cwd: FIXTURE }))
      expect(re.test('/x/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/x/node_modules/cjs-pkg/index.js')).toBe(true)
      expect(re.test('/x/node_modules/no-type-pkg/index.js')).toBe(true)
    })

    it('does not scan nested by default', () => {
      const re = new RegExp(nodeModulesTransformPattern({ scanPackageJson: true, mjs: false, cwd: FIXTURE }))
      expect(re.test('/x/node_modules/parent-pkg/node_modules/nested-esm/index.js')).toBe(true)
    })
  })

  describe('scanNested', () => {
    it('finds nested ESM packages when enabled', () => {
      const re = new RegExp(
        nodeModulesTransformPattern({
          scanPackageJson: true,
          scanNested: true,
          mjs: false,
          cwd: FIXTURE,
        }),
      )
      expect(re.test('/x/node_modules/parent-pkg/node_modules/nested-esm/index.js')).toBe(false)
    })
  })

  describe('resolveSymlinks', () => {
    const PNPM_FIXTURE = path.join(__dirname, '__test-fixtures__/pnpm-layout')

    it('reads through symlinks when enabled', () => {
      const re = new RegExp(
        nodeModulesTransformPattern({
          scanPackageJson: true,
          resolveSymlinks: true,
          mjs: false,
          cwd: PNPM_FIXTURE,
        }),
      )
      expect(re.test('/x/node_modules/esm-real/index.js')).toBe(false)
    })
  })

  describe('cache', () => {
    it('only scans once per (cwd, scanNested, resolveSymlinks) tuple', () => {
      const realFs = jest.requireActual<typeof fs>('fs')
      const spy = jest.spyOn(realFs, 'readdirSync')
      spy.mockClear()
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: FIXTURE })
      const firstCount = spy.mock.calls.length
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: FIXTURE })
      expect(spy.mock.calls.length).toBe(firstCount) // no additional calls
      spy.mockRestore()
    })
  })
})
