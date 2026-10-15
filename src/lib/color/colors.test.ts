import { describe, expect, it } from 'vitest';
import { LIGHTNESS_RANGE, SATURATION_RANGE } from '../constants';
import { assignColors, createRandom } from './colors';

/** テスト用のシード値 */
const SEED = 12345;
/** 別のシード値 */
const OTHER_SEED = 54321;
/** 区画数 */
const COUNT = 8;
/** 32 ビット符号なし整数の最大値 */
const MAX_SEED = 4294967295;
/** 乱数を引く回数 */
const DRAW_COUNT = 1000;

/**
 * hsl 文字列から彩度と明度を取り出す
 *
 * @param color `hsl(h s% l%)` 形式の文字列
 * @returns 彩度と明度
 */
function parseSaturationAndLightness(color: string): { saturation: number; lightness: number } {
	const match = /^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/.exec(color);
	if (match === null) throw new Error(`形式が違う: ${color}`);
	const [, , saturation, lightness] = match;
	return { saturation: Number(saturation), lightness: Number(lightness) };
}

describe('色付け', () => {
	describe('正常系', () => {
		it('同じシードなら同じ色になる', () => {
			expect(assignColors(COUNT, SEED)).toEqual(assignColors(COUNT, SEED));
		});

		it('区画数と同じ個数の色を返す', () => {
			expect(assignColors(COUNT, SEED)).toHaveLength(COUNT);
		});

		it('シードを変えると色が変わる', () => {
			expect(assignColors(COUNT, SEED)).not.toEqual(assignColors(COUNT, OTHER_SEED));
		});

		it('彩度と明度は、決められた範囲に収まる', () => {
			for (const color of assignColors(COUNT, SEED)) {
				const { saturation, lightness } = parseSaturationAndLightness(color);
				expect(saturation).toBeGreaterThanOrEqual(SATURATION_RANGE.min);
				expect(saturation).toBeLessThanOrEqual(SATURATION_RANGE.max);
				expect(lightness).toBeGreaterThanOrEqual(LIGHTNESS_RANGE.min);
				expect(lightness).toBeLessThanOrEqual(LIGHTNESS_RANGE.max);
			}
		});
	});

	describe('異常系', () => {
		it('区画が0件なら空の配列を返す', () => {
			expect(assignColors(0, SEED)).toEqual([]);
		});
	});

	describe('境界条件', () => {
		it('区画数が1でも色を返す', () => {
			expect(assignColors(1, SEED)).toHaveLength(1);
		});

		it('シードが 0 と最大値でも色を返す', () => {
			expect(assignColors(COUNT, 0)).toHaveLength(COUNT);
			expect(assignColors(COUNT, MAX_SEED)).toHaveLength(COUNT);
		});

		it('乱数は 0 以上 1 未満に収まる', () => {
			const random = createRandom(SEED);

			for (let i = 0; i < DRAW_COUNT; i += 1) {
				const value = random();
				expect(value).toBeGreaterThanOrEqual(0);
				expect(value).toBeLessThan(1);
			}
		});
	});
});
