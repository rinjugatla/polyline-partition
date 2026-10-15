import { MAX_RECT_SIZE, MIN_RECT_SIZE } from '../constants';
import { findInvalidPolylines, type InvalidPolyline } from '../geometry/partition';
import { isSamePoint } from '../geometry/primitives';
import type { Point, RectSize } from '../geometry/types';
import { validatePolyline, type RuleId } from '../geometry/validate';
import type { DocumentState } from './document';

/** 編集に成功した結果 */
export type EditSuccess = {
	/** 成功を表す印 */
	readonly ok: true;
	/** 編集後のドキュメント */
	readonly document: DocumentState;
};

/** 編集を拒否した結果 */
export type EditFailure = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 利用者に見せる日本語の理由 */
	readonly messages: readonly string[];
};

/** 編集の結果（想定内の失敗なので判別共用体で返す） */
export type EditResult = EditSuccess | EditFailure;

/** 矩形と ε（検証に必要な文脈） */
export type RectContext = {
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
};

/** 頂点の移動を依頼する情報 */
export type MoveVertexRequest = {
	/** 動かす頂点を持つポリラインの ID */
	readonly polylineId: string;
	/** 動かす頂点の添字 */
	readonly index: number;
	/** 移動先 */
	readonly point: Point;
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
	/**
	 * 検査する規則
	 *
	 * 省略すると V-02〜V-06。ドラッグ中は V-06 を除く（仕様書 第4章）。
	 */
	readonly rules?: readonly RuleId[];
};

/** 頂点の移動で検査する既定の規則 */
const MOVE_RULES: readonly RuleId[] = ['V-02', 'V-03', 'V-04', 'V-05', 'V-06'];

/** 描画中の頂点追加で検査する規則 */
const ADD_VERTEX_RULES: readonly RuleId[] = ['V-02', 'V-04', 'V-05'];

/** ポリライン ID の接頭辞 */
const POLYLINE_ID_PREFIX = 'p';

/**
 * 失敗の結果を作る
 *
 * @param messages 理由
 * @returns 失敗
 */
function fail(messages: readonly string[]): EditFailure {
	return { ok: false, messages };
}

/**
 * 次のポリライン ID
 *
 * 既存の ID の番号の最大値に 1 を足す。削除や読込があっても重複しない。
 *
 * @param document ドキュメント
 * @returns 新しい ID
 */
function nextPolylineId(document: DocumentState): string {
	const numbers = document.polylines
		.map((polyline) => Number(polyline.id.slice(POLYLINE_ID_PREFIX.length)))
		.filter((value) => Number.isInteger(value));
	return `${POLYLINE_ID_PREFIX}${Math.max(0, ...numbers) + 1}`;
}

/**
 * 描画中のポリラインに頂点を足せるか調べる
 *
 * @param draft 描画中の頂点
 * @param candidate 足す頂点
 * @param context 矩形と ε
 * @returns 足せるなら null、拒否するなら理由
 */
export function checkAddVertex(
	draft: readonly Point[],
	candidate: Point,
	context: RectContext
): EditFailure | null {
	const result = validatePolyline({
		vertices: [...draft, candidate],
		...context,
		rules: ADD_VERTEX_RULES
	});
	return result.ok ? null : fail(result.violations.map((violation) => violation.message));
}

/**
 * 末尾の重複頂点を取り除く
 *
 * ダブルクリックによる二重追加の対策。
 *
 * @param vertices 頂点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 末尾の重複を除いた頂点
 */
function trimTrailingDuplicates(vertices: readonly Point[], epsilon: number): Point[] {
	const trimmed = [...vertices];
	while (
		trimmed.length >= 2 &&
		isSamePoint(trimmed[trimmed.length - 1], trimmed[trimmed.length - 2], epsilon)
	) {
		trimmed.pop();
	}
	return trimmed;
}

/**
 * 描画を確定してポリラインを追加
 *
 * 末尾の重複頂点を取り除いてから、全規則で検証する。
 *
 * @param document ドキュメント
 * @param draft 描画中の頂点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 追加後のドキュメント。違反があれば理由
 */
export function finishPolyline(
	document: DocumentState,
	draft: readonly Point[],
	epsilon: number
): EditResult {
	const vertices = trimTrailingDuplicates(draft, epsilon);
	const result = validatePolyline({ vertices, rect: document.rect, epsilon });
	if (!result.ok) return fail(result.violations.map((violation) => violation.message));

	const polyline = { id: nextPolylineId(document), vertices };
	return { ok: true, document: { ...document, polylines: [...document.polylines, polyline] } };
}

/**
 * 頂点を移動
 *
 * @param document ドキュメント
 * @param request 移動の依頼
 * @returns 移動後のドキュメント。違反があれば理由（元の位置に戻す判断は呼び出し側が行う）
 */
export function moveVertex(document: DocumentState, request: MoveVertexRequest): EditResult {
	const { polylineId, index, point, epsilon, rules = MOVE_RULES } = request;
	const target = document.polylines.find((polyline) => polyline.id === polylineId);
	if (target === undefined || index < 0 || index >= target.vertices.length) {
		return fail(['移動する頂点が見つかりません']);
	}

	const vertices = target.vertices.map((vertex, position) => (position === index ? point : vertex));
	const result = validatePolyline({ vertices, rect: document.rect, epsilon, rules });
	if (!result.ok) return fail(result.violations.map((violation) => violation.message));

	const polylines = document.polylines.map((polyline) =>
		polyline.id === polylineId ? { ...polyline, vertices } : polyline
	);
	return { ok: true, document: { ...document, polylines } };
}

/**
 * ポリラインを削除
 *
 * @param document ドキュメント
 * @param polylineId 削除するポリラインの ID
 * @returns 削除後のドキュメント
 */
export function removePolyline(document: DocumentState, polylineId: string): DocumentState {
	return {
		...document,
		polylines: document.polylines.filter((polyline) => polyline.id !== polylineId)
	};
}

/**
 * すべてのポリラインを削除
 *
 * @param document ドキュメント
 * @returns ポリラインのないドキュメント
 */
export function clearPolylines(document: DocumentState): DocumentState {
	return { ...document, polylines: [] };
}

/**
 * 基礎矩形の大きさを変更
 *
 * 範囲外の値は拒否する。ポリラインは保持し、無効になったものは `findInvalid` で見つける。
 *
 * @param document ドキュメント
 * @param rect 新しい大きさ
 * @returns 変更後のドキュメント。範囲外なら理由
 */
export function resizeRect(document: DocumentState, rect: RectSize): EditResult {
	const isInRange = (value: number): boolean =>
		Number.isFinite(value) && value >= MIN_RECT_SIZE && value <= MAX_RECT_SIZE;
	if (!isInRange(rect.width) || !isInRange(rect.height)) {
		return fail([`幅と高さは ${MIN_RECT_SIZE} 以上 ${MAX_RECT_SIZE} 以下にしてください`]);
	}
	return { ok: true, document: { ...document, rect } };
}

/**
 * 無効なポリラインを探す
 *
 * 矩形の大きさや ε の変更で無効になったものを見つけ、赤く表示するのに使う。
 *
 * @param document ドキュメント
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 違反のあるポリライン（なければ空）
 */
export function findInvalid(document: DocumentState, epsilon: number): InvalidPolyline[] {
	return findInvalidPolylines({ polylines: document.polylines, rect: document.rect, epsilon });
}
