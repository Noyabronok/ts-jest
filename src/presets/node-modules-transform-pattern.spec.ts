import * as fs from 'fs'
import path from 'path'

import { nodeModulesTransformPattern, resetScanCacheForTesting } from './node-modules-transform-pattern'

describe('nodeModulesTransformPattern', () => {
  const FIXTURE = path.join(__dirname, '__test-fixtures__')

  beforeEach(() => {
    resetScanCacheForTesting()
  })

  it('returns plain /node_modules/ with no exemptions', () => {
    expect(nodeModulesTransformPattern()).toBe('/node_modules/')
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
  })

  describe('scanPackageJson', () => {
    it('finds top-level "type":"module" packages', () => {
      const re = new RegExp(nodeModulesTransformPattern({ scanPackageJson: true, cwd: FIXTURE }))
      expect(re.test('/x/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/x/node_modules/cjs-pkg/index.js')).toBe(true)
      expect(re.test('/x/node_modules/no-type-pkg/index.js')).toBe(true)
    })
  })

  describe('cache', () => {
    it('only scans once per cwd', () => {
      const realFs = jest.requireActual<typeof fs>('fs')
      const spy = jest.spyOn(realFs, 'readdirSync')
      spy.mockClear()
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: FIXTURE })
      const firstCount = spy.mock.calls.length
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: FIXTURE })
      expect(spy.mock.calls.length).toBe(firstCount)
      spy.mockRestore()
    })
  })
})
