import { describe, expect, it } from 'vitest'
import {
  dinarsToDirhams,
  formatDirhams,
  formatMoney,
  formatQuantity,
  fromMilli,
  toMilli,
} from './units'

describe('money, in dirhams', () => {
  it('converts dinars to whole dirhams at 100 to 1', () => {
    expect(dinarsToDirhams('1')).toBe(100)
    expect(dinarsToDirhams('12.50')).toBe(1250)
    expect(dinarsToDirhams('0.05')).toBe(5)
  })

  it('accepts a comma as the decimal mark', () => {
    expect(dinarsToDirhams('12,50')).toBe(1250)
  })

  it('rounds to the nearest dirham rather than truncating', () => {
    expect(dinarsToDirhams('0.005')).toBe(1)
    expect(dinarsToDirhams('0.004')).toBe(0)
  })

  it('refuses text that is not a number', () => {
    expect(() => dinarsToDirhams('abc')).toThrow()
  })

  it('formats with two decimals and thousands separators', () => {
    expect(formatDirhams(1250)).toBe('12.50')
    expect(formatDirhams(5)).toBe('0.05')
    expect(formatDirhams(123456789)).toBe('1,234,567.89')
    expect(formatMoney(1250)).toBe('12.50 LYD')
  })

  it('formats negative amounts with a single leading minus', () => {
    expect(formatDirhams(-1250)).toBe('-12.50')
  })

  it('survives a round trip', () => {
    for (const [typed, shown] of [
      ['0.01', '0.01'],
      ['7.99', '7.99'],
      ['1234.56', '1,234.56'],
    ]) {
      expect(formatDirhams(dinarsToDirhams(typed))).toBe(shown)
    }
  })
})

describe('quantities, in thousandths of a unit', () => {
  it('scales by a thousand', () => {
    expect(toMilli('2.5')).toBe(2500)
    expect(toMilli('0.125')).toBe(125)
    expect(toMilli(3)).toBe(3000)
  })

  it('trims trailing zeros when displaying', () => {
    expect(fromMilli(2500)).toBe('2.5')
    expect(fromMilli(3000)).toBe('3')
    expect(fromMilli(125)).toBe('0.125')
  })

  it('shows the ingredient unit alongside the number', () => {
    expect(formatQuantity(2500, 'KG')).toBe('2.5 kg')
    expect(formatQuantity(250, 'G')).toBe('0.25 g')
    expect(formatQuantity(4000, 'PIECE')).toBe('4 pcs')
  })

  it('keeps negative stock readable', () => {
    expect(fromMilli(-1500)).toBe('-1.5')
  })
})
