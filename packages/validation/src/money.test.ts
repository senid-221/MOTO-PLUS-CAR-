import { describe, expect, it } from '@jest/globals';
import {
  add,
  fromMinor,
  multiplyByRate,
  splitCommission,
  splitEvenly,
  subtract,
  toMinor,
} from './money';

describe('money: decimal-safe conversion', () => {
  it('parses whole and fractional RWF amounts into minor units', () => {
    expect(toMinor('1500')).toBe(150000);
    expect(toMinor('1500.5')).toBe(150050);
    expect(toMinor('1500.55')).toBe(150055);
    expect(toMinor('0.05')).toBe(5);
    expect(toMinor('-250.25')).toBe(-25025);
  });

  it('rejects amounts with more than two decimals', () => {
    expect(() => toMinor('1500.555')).toThrow(TypeError);
    expect(() => toMinor('1,500')).toThrow(TypeError);
    expect(() => toMinor('abc')).toThrow(TypeError);
  });

  it('renders minor units with exactly two decimals', () => {
    expect(fromMinor(150000)).toBe('1500.00');
    expect(fromMinor(5)).toBe('0.05');
    expect(fromMinor(-25025)).toBe('-250.25');
  });

  it('refuses non-integer minor units', () => {
    expect(() => fromMinor(10.5)).toThrow(TypeError);
  });

  it('adds without floating point drift', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point arithmetic.
    expect(add('0.10', '0.20')).toBe('0.30');
    expect(add('500', '250.75', '0.25')).toBe('751.00');
    expect(subtract('1000', '250.50', '250.50')).toBe('499.00');
  });
});

describe('money: rates and rounding', () => {
  it('rounds half away from zero', () => {
    expect(multiplyByRate('100', 0.025)).toBe('2.50');
    expect(multiplyByRate('100.10', 0.1)).toBe('10.01');
    expect(multiplyByRate('-100', 0.025)).toBe('-2.50');
  });

  it('splits a fare so that commission and payout always sum to gross', () => {
    const cases: Array<[string, number]> = [
      ['1000', 0.15],
      ['1500.33', 0.15],
      ['999.99', 0.075],
      ['1', 0.2],
    ];
    cases.forEach(([gross, rate]) => {
      const split = splitCommission(gross, rate);
      expect(add(split.commission, split.payout)).toBe(split.gross);
      expect(toMinor(split.gross)).toBe(toMinor(gross));
    });
  });

  it('rejects commission rates outside 0..1', () => {
    expect(() => splitCommission('1000', 1.5)).toThrow(RangeError);
    expect(() => splitCommission('1000', -0.1)).toThrow(RangeError);
  });
});

describe('money: even splits', () => {
  it('distributes the remainder to the leading parts', () => {
    expect(splitEvenly('100', 3)).toEqual(['33.34', '33.33', '33.33']);
    expect(splitEvenly('10', 4)).toEqual(['2.50', '2.50', '2.50', '2.50']);
    expect(add(...splitEvenly('100', 7))).toBe('100.00');
  });

  it('rejects a non-positive part count', () => {
    expect(() => splitEvenly('100', 0)).toThrow(RangeError);
    expect(() => splitEvenly('100', 1.5)).toThrow(RangeError);
  });
});
