import { GOLDEN_ANGLE, HUE_CYCLE, LIGHTNESS_RANGE, SATURATION_RANGE } from '../constants';

/** mulberry32 の加算定数 */
const MULBERRY_INCREMENT = 0x6d2b79f5;
/** mulberry32 の混ぜ込みの回転量（1回目） */
const MULBERRY_SHIFT_A = 15;
/** mulberry32 の混ぜ込みの回転量（2回目） */
const MULBERRY_SHIFT_B = 7;
/** mulberry32 の仕上げの回転量 */
const MULBERRY_SHIFT_C = 14;
/** mulberry32 の2回目の乗算で足す定数 */
const MULBERRY_MIX = 61;
/** 32 ビット符号なし整数の個数（0 以上 1 未満に正規化する分母） */
const UINT32_RANGE = 4294967296;

/**
 * シード付きの乱数生成器（mulberry32）
 *
 * 同じシードなら同じ列を返すので、同じ入力から同じ色を再現できる。
 *
 * @param seed シード値（整数）
 * @returns 呼ぶたびに 0 以上 1 未満の乱数を返す関数
 */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + MULBERRY_INCREMENT) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_A), t | 1);
		t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), t | MULBERRY_MIX);
		return ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
	};
}

/** 値の範囲 */
type ValueRange = {
	/** 下限 */
	readonly min: number;
	/** 上限 */
	readonly max: number;
};

/**
 * 範囲内の値を乱数で選ぶ
 *
 * @param random 乱数生成器
 * @param range 下限と上限
 * @returns 範囲内の値
 */
function pickInRange(random: () => number, range: ValueRange): number {
	return range.min + random() * (range.max - range.min);
}

/**
 * 区画の色を決める
 *
 * i 番目の色相は `(hue0 + i × 黄金角) mod 360`。hue0、彩度、明度はシード付き乱数で決める。
 * 区画の並びが決定的なので、同じシードと区画数なら同じ色になる。
 *
 * @param count 区画の数
 * @param seed 色を決めるシード値
 * @returns 区画の番号順の CSS の色（hsl）
 */
export function assignColors(count: number, seed: number): string[] {
	const random = createRandom(seed);
	const firstHue = random() * HUE_CYCLE;
	return Array.from({ length: count }, (_, index) => {
		const hue = (firstHue + index * GOLDEN_ANGLE) % HUE_CYCLE;
		const saturation = pickInRange(random, SATURATION_RANGE);
		const lightness = pickInRange(random, LIGHTNESS_RANGE);
		return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
	});
}
