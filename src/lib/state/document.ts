import { DEFAULT_COLOR_SEED, DEFAULT_RECT_SIZE, DOCUMENT_SCHEMA_VERSION } from '../constants';
import type { Polyline, RectSize } from '../geometry/types';

/** 編集対象のドキュメント（JSON に保存する） */
export type DocumentState = {
	/** スキーマのバージョン */
	readonly schemaVersion: typeof DOCUMENT_SCHEMA_VERSION;
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** ポリライン */
	readonly polylines: readonly Polyline[];
	/** 区画の色を決めるシード値 */
	readonly colorSeed: number;
};

/**
 * 新規ドキュメントを作成
 *
 * @returns 既定の大きさの矩形だけを持つドキュメント
 */
export function createDocument(): DocumentState {
	return {
		schemaVersion: DOCUMENT_SCHEMA_VERSION,
		rect: { width: DEFAULT_RECT_SIZE, height: DEFAULT_RECT_SIZE },
		polylines: [],
		colorSeed: DEFAULT_COLOR_SEED
	};
}
