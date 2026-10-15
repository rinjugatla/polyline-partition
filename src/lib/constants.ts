/**
 * ε（同値判定の許容誤差）の既定値
 *
 * 座標の最大値に対して十分小さく、通常の入力で別の頂点を同一視しない大きさにした。
 */
export const DEFAULT_EPSILON = 0.01;

/**
 * ε の下限
 *
 * これより小さいと浮動小数点の計算誤差と区別できなくなる。
 */
export const MIN_EPSILON = 0.0001;

/**
 * ε の上限
 *
 * これより大きいと近接する別の頂点まで同一視してしまう。
 */
export const MAX_EPSILON = 1;

/**
 * 座標の絶対値の上限
 *
 * ε との桁差を保ち、頂点の併合後に近接を再検査しなくてよい前提にする。
 */
export const MAX_COORDINATE = 100000;

/** 基礎矩形の幅と高さの既定値 */
export const DEFAULT_RECT_SIZE = 1000;

/** 基礎矩形の幅と高さの下限 */
export const MIN_RECT_SIZE = 10;

/** 基礎矩形の幅と高さの上限 */
export const MAX_RECT_SIZE = 10000;

/** グリッドスナップが有効かの既定値 */
export const DEFAULT_SNAP_ENABLED = true;

/**
 * グリッドスナップの刻みの既定値
 *
 * 既定の基礎矩形を操作しやすい粒度で区切れる大きさにした。
 */
export const DEFAULT_SNAP_STEP = 10;

/** グリッドスナップの刻みの下限 */
export const MIN_SNAP_STEP = 0.1;

/** グリッドスナップの刻みの上限 */
export const MAX_SNAP_STEP = 1000;

/**
 * 面積を持つ多角形に必要な頂点数の下限
 *
 * 3点以上でなければ囲まれた領域ができない。
 */
export const MIN_POLYGON_VERTICES = 3;

/**
 * ポリラインの頂点数の下限
 *
 * 線分が1本もなければ線にならない。
 */
export const MIN_VERTEX_COUNT = 2;

/**
 * 多角形の重心の公式にある、面積にかける係数（重心 = 総和 / (6 × 面積)）
 *
 * 靴ひも公式の外積の総和から重心を求めるときに現れる。
 */
export const CENTROID_AREA_FACTOR = 6;

/**
 * 区画の色を決めるシード値の既定値
 *
 * 任意の整数でよい。新規ドキュメントの色を毎回同じにして、挙動を再現しやすくする。
 */
export const DEFAULT_COLOR_SEED = 12345;

/** ドキュメントの JSON スキーマのバージョン */
export const DOCUMENT_SCHEMA_VERSION = 1;

/** アプリ設定を localStorage に保存するときのキー */
export const SETTINGS_STORAGE_KEY = 'polyline-partition:settings';

/** アプリ設定の保存形式のバージョン */
export const SETTINGS_SCHEMA_VERSION = 1;

/**
 * 全体表示で、基礎矩形の周囲に設ける余白の割合
 *
 * 画面の短いほうの辺に対する割合。頂点ハンドルや矩形の外側の始終端が見える広さにした。
 */
export const VIEW_MARGIN_RATIO = 0.1;

/** ズーム倍率の下限（全体表示の倍率に対する割合） */
export const MIN_ZOOM_RATIO = 0.1;

/** ズーム倍率の上限（全体表示の倍率に対する割合） */
export const MAX_ZOOM_RATIO = 100;

/** ホイール1目盛りあたりのズームの係数 */
export const ZOOM_STEP = 1.1;

/** 頂点ハンドルの半径（画面のピクセル） */
export const HANDLE_RADIUS = 6;

/**
 * 区画の色相をずらす角度（黄金角）
 *
 * 隣り合う番号の色相が離れ、区画数が増えても色が重なりにくい。
 */
export const GOLDEN_ANGLE = 137.508;

/** 色相の一周（度） */
export const HUE_CYCLE = 360;

/** 区画の彩度の範囲（%） */
export const SATURATION_RANGE = { min: 60, max: 75 } as const;

/** 区画の明度の範囲（%） */
export const LIGHTNESS_RANGE = { min: 55, max: 70 } as const;

/** 色のシード値の上限（32 ビット符号なし整数の範囲） */
export const MAX_COLOR_SEED = 4294967295;

/** 選択中のポリラインの線の太さ（画面のピクセル） */
export const SELECTED_STROKE_WIDTH = 4;

/** SVG 出力で、基礎矩形の枠に使う線の色 */
export const SVG_FRAME_STROKE = '#000000';

/** SVG 出力で、ポリラインに使う線の色。区画の塗りと区別できる濃い色にする */
export const SVG_POLYLINE_STROKE = '#1f2937';

/** SVG 出力の線の太さ（論理座標の単位）。基礎矩形の既定の大きさ（1000）でも見える細さにする */
export const SVG_STROKE_WIDTH = 2;

/** JSON の保存ファイル名 */
export const JSON_FILE_NAME = 'polyline-partition.json';

/** SVG の出力ファイル名 */
export const SVG_FILE_NAME = 'polyline-partition.svg';

/** キャンバス上の線（枠、非選択のポリライン、頂点ハンドル、作成中の線）の太さ（px） */
export const CANVAS_STROKE_WIDTH = 2;

/** 作成中の線の破線の間隔（線の長さ、空白の長さ。px） */
export const DRAFT_DASH_PATTERN = '6 4';

/** カーソル位置の表示で使う小数の桁数 */
export const CURSOR_DECIMALS = 1;
