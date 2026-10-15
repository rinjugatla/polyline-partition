import { SVG_FRAME_STROKE, SVG_POLYLINE_STROKE, SVG_STROKE_WIDTH } from '../constants';
import type { Point, Polyline, RectSize } from '../geometry/types';

/** SVG に描く区画 */
export type SvgRegion = {
	/** 区画の外周の頂点 */
	readonly polygon: readonly Point[];
	/** 塗りつぶしの色（CSS の色） */
	readonly color: string;
};

/** SVG 出力の入力 */
export type SvgRequest = {
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** 描くポリライン */
	readonly polylines: readonly Polyline[];
	/** 描く区画。未分割なら空 */
	readonly regions: readonly SvgRegion[];
};

/**
 * 頂点列を points 属性の文字列にする
 *
 * @param points 頂点列
 * @returns 「x,y」を空白で区切った文字列
 */
function toPointsAttribute(points: readonly Point[]): string {
	return points.map((point) => `${point.x},${point.y}`).join(' ');
}

/**
 * 区画を polygon 要素にする
 *
 * @param region 区画
 * @returns polygon 要素の文字列
 */
function toPolygonElement(region: SvgRegion): string {
	return `<polygon points="${toPointsAttribute(region.polygon)}" fill="${region.color}" />`;
}

/**
 * ポリラインを polyline 要素にする
 *
 * @param polyline ポリライン
 * @returns polyline 要素の文字列
 */
function toPolylineElement(polyline: Polyline): string {
	return `<polyline points="${toPointsAttribute(polyline.vertices)}" fill="none" stroke="${SVG_POLYLINE_STROKE}" stroke-width="${SVG_STROKE_WIDTH}" />`;
}

/**
 * SVG 文字列を作る
 *
 * 論理座標のまま出力し、Y 軸の反転は transform で行う。描画順は枠、区画、ポリライン。
 *
 * @param request 出力する内容
 * @returns SVG 文書の文字列
 */
export function exportSvg(request: SvgRequest): string {
	const { width, height } = request.rect;
	const frame = `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${SVG_FRAME_STROKE}" stroke-width="${SVG_STROKE_WIDTH}" />`;
	const elements = [
		frame,
		...request.regions.map(toPolygonElement),
		...request.polylines.map(toPolylineElement)
	];
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
		`<g transform="translate(0, ${height}) scale(1, -1)">`,
		...elements.map((element) => `  ${element}`),
		'</g>',
		'</svg>',
		''
	].join('\n');
}
