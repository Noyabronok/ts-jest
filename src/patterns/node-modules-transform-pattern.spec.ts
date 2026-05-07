import * as fs from 'fs'

import { vol } from 'memfs'

import { nodeModulesTransformPattern, resetScanCacheForTesting } from './node-modules-transform-pattern'

jest.mock('fs', () => {
  const memfsFs = require('memfs').fs

  return {
    ...memfsFs,
    readdirSync: jest.fn((...args: Parameters<typeof memfsFs.readdirSync>) => memfsFs.readdirSync(...args)),
  }
})

const CWD = '/fixture'

const FIXTURE_FS = {
  [`${CWD}/node_modules/esm-pkg/package.json`]:
    '{"name":"esm-pkg","version":"1.0.0","type":"module","main":"index.js"}',
  [`${CWD}/node_modules/esm-pkg/index.js`]: '',
  [`${CWD}/node_modules/cjs-pkg/package.json`]: '{"name":"cjs-pkg","version":"1.0.0","main":"index.js"}',
  [`${CWD}/node_modules/cjs-pkg/index.js`]: '',
  [`${CWD}/node_modules/no-type-pkg/package.json`]: '{"name":"no-type-pkg","version":"1.0.0"}',
  [`${CWD}/node_modules/parent-pkg/package.json`]: '{"name":"parent-pkg","version":"1.0.0"}',
}

describe('nodeModulesTransformPattern', () => {
  beforeEach(() => {
    vol.reset()
    vol.fromJSON(FIXTURE_FS)
    resetScanCacheForTesting()
  })

  afterAll(() => {
    vol.reset()
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
      const re = new RegExp(nodeModulesTransformPattern({ scanPackageJson: true, cwd: CWD }))
      expect(re.test('/x/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/x/node_modules/cjs-pkg/index.js')).toBe(true)
      expect(re.test('/x/node_modules/no-type-pkg/index.js')).toBe(true)
    })
  })

  describe('mjs', () => {
    it('exempts .mjs files', () => {
      const re = new RegExp(nodeModulesTransformPattern({ mjs: true }))
      expect(re.test('/repo/node_modules/some-pkg/index.mjs')).toBe(false)
      expect(re.test('/repo/node_modules/some-pkg/index.js')).toBe(true)
    })

    it('combines mjs with extraPackages', () => {
      const re = new RegExp(nodeModulesTransformPattern({ mjs: true, extraPackages: ['esm-pkg'] }))
      expect(re.test('/repo/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/repo/node_modules/some-pkg/index.mjs')).toBe(false)
      expect(re.test('/repo/node_modules/cjs-pkg/index.js')).toBe(true)
    })

    it('combines mjs with scanPackageJson', () => {
      const re = new RegExp(nodeModulesTransformPattern({ mjs: true, scanPackageJson: true, cwd: CWD }))
      expect(re.test('/x/node_modules/esm-pkg/index.js')).toBe(false)
      expect(re.test('/x/node_modules/some-pkg/index.mjs')).toBe(false)
      expect(re.test('/x/node_modules/cjs-pkg/index.js')).toBe(true)
    })
  })

  describe('cache', () => {
    it('only scans once per cwd', () => {
      const readdirSpy = fs.readdirSync as jest.Mock
      readdirSpy.mockClear()
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: CWD })
      const firstCount = readdirSpy.mock.calls.length
      nodeModulesTransformPattern({ scanPackageJson: true, cwd: CWD })
      expect(readdirSpy.mock.calls.length).toBe(firstCount)
    })
  })
})
