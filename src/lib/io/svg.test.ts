import { describe, expect, it } from 'vitest';
import { exportSvg, type SvgRegion } from './svg';

/** 矩形の幅 */
const WIDTH = 300;
/** 矩形の高さ */
const HEIGHT = 200;
/** 矩形の外側にはみ出す量 */
const OVERSHOOT = 10;
/** 矩形の外の座標 */
const OUTSIDE = -OVERSHOOT;

/** 基礎矩形の大きさ */
const RECT = { width: WIDTH, height: HEIGHT };

/** テスト用の区画 */
const REGIONS: readonly SvgRegion[] = [
	{
		polygon: [
			{ x: 0, y: 0 },
			{ x: WIDTH, y: 0 },
			{ x: 0, y: HEIGHT }
		],
		color: 'hsl(10, 60%, 60%)'
	},
	{
		polygon: [
			{ x: WIDTH, y: 0 },
			{ x: WIDTH, y: HEIGHT },
			{ x: 0, y: HEIGHT }
		],
		color: 'hsl(200, 60%, 60%)'
	}
];

/** テスト用のポリライン */
const POLYLINES = [
	{
		id: 'p1',
		vertices: [
			{ x: OUTSIDE, y: HEIGHT + OVERSHOOT },
			{ x: WIDTH + OVERSHOOT, y: OUTSIDE }
		]
	}
];

/**
 * 文字列中の部分文字列の出現回数を数える
 *
 * @param text 検索対象
 * @param part 数える文字列
 * @returns 出現回数
 */
function count(text: string, part: string): number {
	return text.split(part).length - 1;
}

describe('SVG 出力', () => {
	describe('正常系', () => {
		it('viewBox を基礎矩形の範囲にし、Y 軸を反転する', () => {
			const svg = exportSvg({ rect: RECT, polylines: POLYLINES, regions: REGIONS });

			expect(svg).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
			expect(svg).toContain(`transform="translate(0, ${HEIGHT}) scale(1, -1)"`);
		});

		it('polygon が区画数と一致し、色を塗る', () => {
			const svg = exportSvg({ rect: RECT, polylines: POLYLINES, regions: REGIONS });

			expect(count(svg, '<polygon')).toBe(REGIONS.length);
			expect(svg).toContain('fill="hsl(10, 60%, 60%)"');
		});

		it('枠、区画、ポリラインの順に描く', () => {
			const svg = exportSvg({ rect: RECT, polylines: POLYLINES, regions: REGIONS });

			const frame = svg.indexOf('<rect');
			const polygon = svg.indexOf('<polygon');
			const polyline = svg.indexOf('<polyline');
			expect(frame).toBeLessThan(polygon);
			expect(polygon).toBeLessThan(polyline);
		});
	});

	describe('異常系', () => {
		it('論理座標をそのまま出力する（Y 座標を変換しない）', () => {
			const svg = exportSvg({ rect: RECT, polylines: POLYLINES, regions: [] });

			expect(svg).toContain(
				`points="${OUTSIDE},${HEIGHT + OVERSHOOT} ${WIDTH + OVERSHOOT},${OUTSIDE}"`
			);
		});
	});

	describe('境界条件', () => {
		it('未分割（区画なし）のときは polygon を出力しない', () => {
			const svg = exportSvg({ rect: RECT, polylines: POLYLINES, regions: [] });

			expect(count(svg, '<polygon')).toBe(0);
		});

		it('ポリラインが0本のときは polyline を出力しない', () => {
			const svg = exportSvg({ rect: RECT, polylines: [], regions: [] });

			expect(count(svg, '<polyline')).toBe(0);
			expect(count(svg, '<rect')).toBe(1);
		});
	});
});
