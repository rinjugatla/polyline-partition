import {
	DOCUMENT_SCHEMA_VERSION,
	MAX_COLOR_SEED,
	MAX_COORDINATE,
	MAX_RECT_SIZE,
	MIN_RECT_SIZE
} from '../constants';
import type { Point, Polyline, RectSize } from '../geometry/types';
import { isPointWithinCoordinateLimit } from '../geometry/validate';
import type { DocumentState } from '../state/document';
import { findInvalid } from '../state/documentOps';

/** JSON の読込に成功した結果 */
export type JsonLoadSuccess = {
	/** 成功を表す印 */
	readonly ok: true;
	/** 検証済みのドキュメント */
	readonly document: DocumentState;
};

/** JSON の読込に失敗した結果 */
export type JsonLoadFailure = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 利用者に見せる日本語の理由（複数あるときは全件） */
	readonly messages: readonly string[];
};

/** JSON の読込結果（想定内の失敗なので判別共用体で返す） */
export type JsonLoadResult = JsonLoadSuccess | JsonLoadFailure;

/** 形式の検査に成功した結果 */
type ShapeSuccess<T> = {
	/** 成功を表す印 */
	readonly ok: true;
	/** 検査済みの値 */
	readonly value: T;
};

/** 形式の検査に失敗した結果 */
type ShapeFailure = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 利用者に見せる日本語の理由 */
	readonly message: string;
};

/** 形式の検査結果 */
type ShapeResult<T> = ShapeSuccess<T> | ShapeFailure;

/**
 * ドキュメントを JSON 文字列にする
 *
 * @param document 保存するドキュメント
 * @returns 整形した JSON 文字列
 */
export function serializeDocument(document: DocumentState): string {
	return JSON.stringify(document, null, 2);
}

/**
 * 失敗を作る
 *
 * @param message 理由
 * @returns 失敗
 */
function fail(message: string): ShapeFailure {
	return { ok: false, message };
}

/**
 * 値がオブジェクトか
 *
 * @param value 調べる値
 * @returns 配列と null を除くオブジェクトなら true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 値が有限の数値か
 *
 * @param value 調べる値
 * @returns 有限の数値なら true
 */
function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 基礎矩形の形式と範囲を検査
 *
 * @param value 検査する値
 * @returns 検査結果
 */
function parseRect(value: unknown): ShapeResult<RectSize> {
	if (!isRecord(value)) return fail('rect がオブジェクトではありません');
	const { width, height } = value;
	if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
		return fail('rect の width と height は数値で指定してください');
	}
	const isInRange = (size: number): boolean => size >= MIN_RECT_SIZE && size <= MAX_RECT_SIZE;
	if (!isInRange(width) || !isInRange(height)) {
		return fail(`rect の大きさは ${MIN_RECT_SIZE} 以上 ${MAX_RECT_SIZE} 以下にしてください`);
	}
	return { ok: true, value: { width, height } };
}

/**
 * 頂点の形式を検査
 *
 * @param value 検査する値
 * @returns 検査結果
 */
function parsePoint(value: unknown): ShapeResult<Point> {
	if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
		return fail('頂点は数値の x と y を持つ必要があります');
	}
	return { ok: true, value: { x: value.x, y: value.y } };
}

/**
 * ポリラインの形式を検査
 *
 * @param value 検査する値
 * @returns 検査結果
 */
function parsePolyline(value: unknown): ShapeResult<Polyline> {
	if (!isRecord(value)) return fail('polylines の要素がオブジェクトではありません');
	const { id, vertices } = value;
	if (typeof id !== 'string' || id === '') return fail('ポリラインの id が文字列ではありません');
	if (!Array.isArray(vertices)) return fail(`ポリライン ${id} の vertices が配列ではありません`);
	const points: Point[] = [];
	for (const vertex of vertices) {
		const point = parsePoint(vertex);
		if (!point.ok) return fail(`ポリライン ${id}: ${point.message}`);
		points.push(point.value);
	}
	return { ok: true, value: { id, vertices: points } };
}

/**
 * ポリライン配列の形式を検査し、ID の重複も拒否
 *
 * @param value 検査する値
 * @returns 検査結果
 */
function parsePolylines(value: unknown): ShapeResult<Polyline[]> {
	if (!Array.isArray(value)) return fail('polylines が配列ではありません');
	const polylines: Polyline[] = [];
	const ids = new Set<string>();
	for (const item of value) {
		const polyline = parsePolyline(item);
		if (!polyline.ok) return polyline;
		if (ids.has(polyline.value.id)) {
			return fail(`ポリラインの id が重複しています: ${polyline.value.id}`);
		}
		ids.add(polyline.value.id);
		polylines.push(polyline.value);
	}
	return { ok: true, value: polylines };
}

/**
 * 色のシードの形式と範囲を検査
 *
 * @param value 検査する値
 * @returns 検査結果
 */
function parseColorSeed(value: unknown): ShapeResult<number> {
	const isValid =
		isFiniteNumber(value) && Number.isInteger(value) && value >= 0 && value <= MAX_COLOR_SEED;
	if (!isValid) return fail(`colorSeed は 0 以上 ${MAX_COLOR_SEED} 以下の整数にしてください`);
	return { ok: true, value };
}

/**
 * JSON のうち、型と数値範囲を検査してドキュメントにする
 *
 * @param parsed JSON.parse の結果
 * @returns 検査結果
 */
function parseShape(parsed: unknown): ShapeResult<DocumentState> {
	if (!isRecord(parsed)) return fail('JSON のルートがオブジェクトではありません');
	if (parsed.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
		return fail(`schemaVersion が ${DOCUMENT_SCHEMA_VERSION} ではありません`);
	}
	const rect = parseRect(parsed.rect);
	if (!rect.ok) return rect;
	const polylines = parsePolylines(parsed.polylines);
	if (!polylines.ok) return polylines;
	const colorSeed = parseColorSeed(parsed.colorSeed);
	if (!colorSeed.ok) return colorSeed;
	return {
		ok: true,
		value: {
			schemaVersion: DOCUMENT_SCHEMA_VERSION,
			rect: rect.value,
			polylines: polylines.value,
			colorSeed: colorSeed.value
		}
	};
}

/**
 * 座標がすべて ±MAX_COORDINATE に収まるかを含めて、V-01〜V-06 を検査
 *
 * V-05 の判定は検証側（geometry）の関数を共用する。V-05 に違反する座標が
 * 後続の幾何検証へ渡らないよう、他の規則より先に検査して打ち切る。
 *
 * @param document 形式の検査を終えたドキュメント
 * @param epsilon 現在の ε
 * @returns 違反の説明。なければ空配列
 */
function collectViolationMessages(document: DocumentState, epsilon: number): string[] {
	const messages: string[] = [];
	for (const polyline of document.polylines) {
		if (!polyline.vertices.every(isPointWithinCoordinateLimit)) {
			messages.push(`${polyline.id}: [V-05] 座標が ±${MAX_COORDINATE} の範囲外です`);
		}
	}
	if (messages.length > 0) return messages;
	for (const invalid of findInvalid(document, epsilon)) {
		for (const violation of invalid.violations) {
			messages.push(`${invalid.polylineId}: [${violation.rule}] ${violation.message}`);
		}
	}
	return messages;
}

/**
 * JSON 文字列を読み込み、検証してドキュメントにする
 *
 * @param text JSON 文字列
 * @param epsilon 検証に使う現在の ε
 * @returns 読込結果。1つでも違反があれば失敗
 */
export function parseDocument(text: string, epsilon: number): JsonLoadResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, messages: ['JSON として読み込めません'] };
	}
	const shape = parseShape(parsed);
	if (!shape.ok) return { ok: false, messages: [shape.message] };
	const messages = collectViolationMessages(shape.value, epsilon);
	if (messages.length > 0) return { ok: false, messages };
	return { ok: true, document: shape.value };
}
