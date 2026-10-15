import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON, MAX_COLOR_SEED, MAX_COORDINATE } from '../constants';
import type { DocumentState } from '../state/document';
import { parseDocument, serializeDocument, type JsonLoadResult } from './json';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の左外の座標 */
const OUTSIDE_LEFT = -50;
/** 矩形の右外の座標 */
const OUTSIDE_RIGHT = 1050;
/** 矩形の大きさ */
const SIZE = 1000;
/** 色のシード */
const SEED = 777;
/** 範囲外の矩形の大きさ */
const TOO_SMALL_SIZE = 1;

/** 左右に抜ける水平線を1本持つ、有効なドキュメント */
const VALID: DocumentState = {
	schemaVersion: 1,
	rect: { width: SIZE, height: SIZE },
	polylines: [
		{
			id: 'p1',
			vertices: [
				{ x: OUTSIDE_LEFT, y: MID },
				{ x: OUTSIDE_RIGHT, y: MID }
			]
		}
	],
	colorSeed: SEED
};

/**
 * ドキュメントの一部を差し替えた JSON 文字列を作る
 *
 * @param override 差し替える項目
 * @returns JSON 文字列
 */
function jsonWith(override: Record<string, unknown>): string {
	return JSON.stringify({ ...VALID, ...override });
}

/**
 * 失敗を前提に、理由の一覧を取り出す
 *
 * @param result 読込結果
 * @returns 理由の一覧
 */
function messagesOf(result: JsonLoadResult): readonly string[] {
	if (result.ok) throw new Error('失敗するはずの読込が成功した');
	return result.messages;
}

describe('JSON の保存と読込', () => {
	describe('正常系', () => {
		it('保存して読み込むと同じドキュメントになる', () => {
			const result = parseDocument(serializeDocument(VALID), DEFAULT_EPSILON);

			expect(result).toEqual({ ok: true, document: VALID });
		});

		it('ポリラインが0本のドキュメントを読み込める', () => {
			const empty = { ...VALID, polylines: [] };

			const result = parseDocument(serializeDocument(empty), DEFAULT_EPSILON);

			expect(result).toEqual({ ok: true, document: empty });
		});
	});

	describe('異常系', () => {
		it('JSON として不正な文字列を拒否する', () => {
			expect(messagesOf(parseDocument('{', DEFAULT_EPSILON))).toEqual([
				'JSON として読み込めません'
			]);
		});

		it('ルートがオブジェクトでない JSON を拒否する', () => {
			expect(parseDocument('[]', DEFAULT_EPSILON).ok).toBe(false);
		});

		it('schemaVersion が一致しないと拒否する', () => {
			const result = parseDocument(jsonWith({ schemaVersion: 2 }), DEFAULT_EPSILON);

			expect(messagesOf(result)[0]).toContain('schemaVersion');
		});

		it('矩形の大きさが範囲外だと拒否する', () => {
			const result = parseDocument(
				jsonWith({ rect: { width: TOO_SMALL_SIZE, height: SIZE } }),
				DEFAULT_EPSILON
			);

			expect(messagesOf(result)[0]).toContain('rect');
		});

		it('頂点が数値でないと拒否する', () => {
			const polylines = [{ id: 'p1', vertices: [{ x: 'a', y: 0 }] }];

			expect(parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON).ok).toBe(false);
		});

		it('ポリラインの ID が重複すると拒否する', () => {
			const polylines = [...VALID.polylines, ...VALID.polylines];

			const result = parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON);

			expect(messagesOf(result)[0]).toContain('重複');
		});

		it('colorSeed が整数でないと拒否する', () => {
			expect(parseDocument(jsonWith({ colorSeed: 1.5 }), DEFAULT_EPSILON).ok).toBe(false);
		});

		it('V-01 に違反する頂点1個のポリラインを拒否する', () => {
			const polylines = [{ id: 'p1', vertices: [{ x: OUTSIDE_LEFT, y: MID }] }];

			const result = parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON);

			expect(messagesOf(result).join('\n')).toContain('V-01');
		});

		it('V-06 に違反する、矩形と交わらないポリラインを拒否する', () => {
			const polylines = [
				{
					id: 'p1',
					vertices: [
						{ x: OUTSIDE_LEFT, y: OUTSIDE_RIGHT },
						{ x: OUTSIDE_RIGHT, y: OUTSIDE_RIGHT }
					]
				}
			];

			const result = parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON);

			expect(messagesOf(result).join('\n')).toContain('V-06');
		});

		it('V-05 に違反する範囲外の座標を拒否する', () => {
			const polylines = [
				{
					id: 'p1',
					vertices: [
						{ x: -(MAX_COORDINATE + 1), y: MID },
						{ x: OUTSIDE_RIGHT, y: MID }
					]
				}
			];

			const result = parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON);

			expect(messagesOf(result).join('\n')).toContain('V-05');
		});

		it('V-04 に違反する自己交差を拒否する', () => {
			const polylines = [
				{
					id: 'p1',
					vertices: [
						{ x: OUTSIDE_LEFT, y: MID },
						{ x: OUTSIDE_RIGHT, y: MID },
						{ x: OUTSIDE_RIGHT, y: OUTSIDE_RIGHT },
						{ x: MID, y: OUTSIDE_RIGHT },
						{ x: MID, y: OUTSIDE_LEFT }
					]
				}
			];

			const result = parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON);

			expect(messagesOf(result).join('\n')).toContain('V-04');
		});
	});

	describe('境界条件', () => {
		it('colorSeed が下限と上限のときに読み込める', () => {
			expect(parseDocument(jsonWith({ colorSeed: 0 }), DEFAULT_EPSILON).ok).toBe(true);
			expect(parseDocument(jsonWith({ colorSeed: MAX_COLOR_SEED }), DEFAULT_EPSILON).ok).toBe(true);
		});

		it('colorSeed が上限を超えると拒否する', () => {
			const result = parseDocument(jsonWith({ colorSeed: MAX_COLOR_SEED + 1 }), DEFAULT_EPSILON);

			expect(result.ok).toBe(false);
		});

		it('座標がちょうど ±MAX_COORDINATE のときは V-05 に違反しない', () => {
			const polylines = [
				{
					id: 'p1',
					vertices: [
						{ x: -MAX_COORDINATE, y: MID },
						{ x: MAX_COORDINATE, y: MID }
					]
				}
			];

			expect(parseDocument(jsonWith({ polylines }), DEFAULT_EPSILON).ok).toBe(true);
		});
	});
});
