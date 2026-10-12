import type { Point, SnapSettings } from './types';

/** 入力座標の補正に必要な情報 */
export type InputPointRequest = {
	/** カーソル位置の論理座標 */
	readonly point: Point;
	/** グリッドスナップの設定 */
	readonly snap: SnapSettings;
	/** 軸拘束の基準にする頂点。基準がない（最初の頂点など）ときは null */
	readonly axisBase: Point | null;
	/** Shift による軸拘束を求められているか */
	readonly isAxisConstrained: boolean;
};

/**
 * 値を格子の刻みに丸める
 *
 * @param value 丸める値
 * @param step 格子の刻み
 * @returns 最も近い格子点の値
 */
function snapValue(value: number, step: number): number {
	// 負のゼロ（-0）を 0 に直すため、最後に 0 を足す
	return Math.round(value / step) * step + 0;
}

/**
 * 点を最も近い格子点に吸着
 *
 * @param point 吸着前の点
 * @param step 格子の刻み
 * @returns 吸着後の点
 */
export function snapToGrid(point: Point, step: number): Point {
	return { x: snapValue(point.x, step), y: snapValue(point.y, step) };
}

/**
 * 入力座標を、スナップと軸拘束で補正
 *
 * 軸拘束は、基準の頂点との差の絶対値が大きい軸に沿わせる（x の差が y の差以上なら水平、
 * そうでなければ垂直）。拘束される軸は基準の座標に合わせ、拘束されない軸にはスナップを適用する。
 * 基準がない、または Shift が押されていないときは拘束せず、スナップだけを適用する。
 *
 * @param request 補正前の座標と、補正の設定
 * @returns 補正後の座標
 */
export function resolveInputPoint(request: InputPointRequest): Point {
	const { point, snap, axisBase, isAxisConstrained } = request;
	const snapped = snap.enabled ? snapToGrid(point, snap.step) : point;
	if (!isAxisConstrained || axisBase === null) return snapped;

	// 拘束の向きは、スナップ前のカーソル位置の差で決める
	const isHorizontal = Math.abs(point.x - axisBase.x) >= Math.abs(point.y - axisBase.y);
	return isHorizontal ? { x: snapped.x, y: axisBase.y } : { x: axisBase.x, y: snapped.y };
}
