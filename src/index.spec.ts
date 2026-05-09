import { TsJestTransformer } from './legacy/ts-jest-transformer'

import tsJest, { nodeModulesTransformPattern } from '.'

test('should create an instance of TsJestTransformer', () => {
  expect(tsJest.createTransformer()).toBeInstanceOf(TsJestTransformer)
})

it('exports nodeModulesTransformPattern', () => {
  expect(typeof nodeModulesTransformPattern).toBe('function')
})
