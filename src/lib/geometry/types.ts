/** 論理座標（右手座標系、Y 軸上向き）の点 */
export type Point = {
	/** X 座標（右向きが正） */
	readonly x: number;
	/** Y 座標（上向きが正） */
	readonly y: number;
};

/** 2点を結ぶ線分 */
export type Segment = {
	/** 始点 */
	readonly start: Point;
	/** 終点 */
	readonly end: Point;
};

/**
 * 基礎矩形の大きさ
 *
 * 原点 (0, 0) から (width, height) までの領域。
 */
export type RectSize = {
	/** 幅 W */
	readonly width: number;
	/** 高さ H */
	readonly height: number;
};

/**
 * ポリライン
 *
 * 始点と終点は基礎矩形の外側に置く。
 */
export type Polyline = {
	/** ポリラインを識別する ID */
	readonly id: string;
	/** 順につなぐ頂点（2個以上） */
	readonly vertices: readonly Point[];
};

/** グリッドスナップの設定 */
export type SnapSettings = {
	/** グリッドスナップが有効か */
	readonly enabled: boolean;
	/** 格子の刻み */
	readonly step: number;
};
