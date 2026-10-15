import { MAX_COORDINATE, MIN_VERTEX_COUNT } from '../constants';
import {
	distanceBetween,
	distanceToRect,
	isPointNearSegment,
	passesThroughRectInterior,
	segmentDistance,
	toSegments
} from './primitives';
import type { Point, RectSize, Segment } from './types';

/** ポリラインの検証規則の ID（仕様書 第4章） */
export type RuleId = 'V-01' | 'V-02' | 'V-03' | 'V-04' | 'V-05' | 'V-06';

/**
 * すべての検証規則
 *
 * 違反は、この順に並べて返す。
 */
export const ALL_RULE_IDS: readonly RuleId[] = ['V-01', 'V-02', 'V-03', 'V-04', 'V-05', 'V-06'];

/** 検証規則の違反 */
export type Violation = {
	/** 違反した規則の ID */
	readonly rule: RuleId;
	/** 利用者に見せる日本語の理由 */
	readonly message: string;
};

/** 検証に成功した結果 */
export type ValidationSuccess = {
	/** 成功を表す印 */
	readonly ok: true;
};

/** 検証に失敗した結果 */
export type ValidationFailure = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 違反の一覧（規則 ID の順） */
	readonly violations: readonly Violation[];
};

/**
 * 検証の結果
 *
 * 想定内の失敗なので、例外ではなく判別共用体で返す。
 */
export type ValidationResult = ValidationSuccess | ValidationFailure;

/** ポリライン検証の入力 */
export type ValidationRequest = {
	/** 検証する頂点 */
	readonly vertices: readonly Point[];
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
	/**
	 * 検査する規則
	 *
	 * 省略すると全規則。場面ごとに検査する規則が違う（仕様書 第4章）。
	 */
	readonly rules?: readonly RuleId[];
};

/** 規則を検査するための、頂点から導いた共通の情報 */
type RuleContext = {
	/** 検証する頂点 */
	readonly vertices: readonly Point[];
	/** 連続する頂点を結ぶ線分 */
	readonly segments: readonly Segment[];
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
};

/** 規則ごとの違反メッセージ */
const RULE_MESSAGES: Readonly<Record<RuleId, string>> = {
	'V-01': '頂点は2個以上必要です',
	'V-02': '長さ0の線分（距離が ε 以下の連続する2頂点）は作れません',
	'V-03': '始点と終点は基礎矩形の外側に置いてください',
	'V-04': 'ポリラインが自己交差、接触、または重なっています',
	'V-05': `座標は ±${MAX_COORDINATE} の範囲内にしてください`,
	'V-06': '基礎矩形の内部を通る線にしてください'
};

/**
 * 線分が長さ0とみなせるか
 *
 * @param segment 対象の線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 両端の距離が ε 以下か
 */
function isDegenerate(segment: Segment, epsilon: number): boolean {
	return distanceBetween(segment.start, segment.end) <= epsilon;
}

/**
 * 隣り合う2線分が、共有頂点以外でも接しているか
 *
 * 隣接する線分は共有頂点でのみ接してよい。頂点で折り返して前の線分に重なると、
 * 一方の線分の遠い端点が、もう一方の線分の ε 以内に入る。
 *
 * @param before 前の線分
 * @param after 後の線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 折り返して重なっているか
 */
function isFoldedBack(before: Segment, after: Segment, epsilon: number): boolean {
	return (
		isPointNearSegment(before.start, after, epsilon) ||
		isPointNearSegment(after.end, before, epsilon)
	);
}

/** 自己交差の判定対象になる、2線分の組 */
type SegmentPair = {
	/** 番号の小さい線分 */
	readonly first: Segment;
	/** 番号の大きい線分 */
	readonly second: Segment;
	/** 線分の番号の差（1 なら隣接） */
	readonly gap: number;
};

/**
 * 2線分の組が、自己交差の違反になるか
 *
 * @param pair 判定する組
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 違反か
 */
function isCrossingPair(pair: SegmentPair, epsilon: number): boolean {
	if (pair.gap === 1) return isFoldedBack(pair.first, pair.second, epsilon);
	return segmentDistance(pair.first, pair.second) <= epsilon;
}

/**
 * V-01 を検査
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV01(context: RuleContext): boolean {
	return context.vertices.length < MIN_VERTEX_COUNT;
}

/**
 * V-02 を検査
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV02(context: RuleContext): boolean {
	return context.segments.some((segment) => isDegenerate(segment, context.epsilon));
}

/**
 * V-03 を検査
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV03(context: RuleContext): boolean {
	const { vertices, rect, epsilon } = context;
	return [vertices[0], vertices[vertices.length - 1]].some(
		(end) => distanceToRect(end, rect) <= epsilon
	);
}

/**
 * V-04 を検査
 *
 * 長さ0の線分は V-02 で報告するため取り除き、残った線分の並びで隣接を判断する。
 * 取り除かないと、長さ0の線分の両隣が非隣接として扱われ、共有頂点の接触を二重に報告する。
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV04(context: RuleContext): boolean {
	const { epsilon } = context;
	const segments = context.segments.filter((segment) => !isDegenerate(segment, epsilon));
	for (const [i, first] of segments.entries()) {
		const isCrossing = segments.some(
			(second, j) => j > i && isCrossingPair({ first, second, gap: j - i }, epsilon)
		);
		if (isCrossing) return true;
	}
	return false;
}

/**
 * 点の座標が x, y とも ±MAX_COORDINATE 以内か（V-05 の判定）
 *
 * NaN は比較が常に偽になるため、「以内である」を肯定形で判定して取りこぼさない。
 * ファイル読込（io）からも使い、V-05 の判定を1か所にそろえる。
 *
 * @param point 判定する点
 */
export function isPointWithinCoordinateLimit(point: Point): boolean {
	return Math.abs(point.x) <= MAX_COORDINATE && Math.abs(point.y) <= MAX_COORDINATE;
}

/**
 * V-05 を検査
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV05(context: RuleContext): boolean {
	return !context.vertices.every(isPointWithinCoordinateLimit);
}

/**
 * V-06 を検査
 *
 * @param context 検査の情報
 * @returns 違反か
 */
function violatesV06(context: RuleContext): boolean {
	const { segments, rect, epsilon } = context;
	return !segments.some((segment) => passesThroughRectInterior(segment, rect, epsilon));
}

/** 規則 ID ごとの検査関数 */
const RULE_CHECKS: Readonly<Record<RuleId, (context: RuleContext) => boolean>> = {
	'V-01': violatesV01,
	'V-02': violatesV02,
	'V-03': violatesV03,
	'V-04': violatesV04,
	'V-05': violatesV05,
	'V-06': violatesV06
};

/**
 * ポリラインを検証
 *
 * 指定された規則（省略時は全規則）を V-01 から順に検査し、違反をすべて集める。
 * 頂点が2個未満のときは線分を作れないので、V-01 だけを検査して残りは調べない。
 *
 * @param request 検証する頂点と、矩形、ε、検査する規則
 * @returns 有効なら `{ ok: true }`、違反があれば違反の一覧
 */
export function validatePolyline(request: ValidationRequest): ValidationResult {
	const { vertices, rect, epsilon, rules = ALL_RULE_IDS } = request;
	const context: RuleContext = { vertices, segments: toSegments(vertices), rect, epsilon };
	const selected = ALL_RULE_IDS.filter((rule) => rules.includes(rule));
	const applicable =
		vertices.length < MIN_VERTEX_COUNT ? selected.filter((rule) => rule === 'V-01') : selected;

	const violations = applicable
		.filter((rule) => RULE_CHECKS[rule](context))
		.map((rule) => ({ rule, message: RULE_MESSAGES[rule] }));
	return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
