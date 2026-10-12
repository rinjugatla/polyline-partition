/** ε（同値判定の許容誤差）の既定値。座標の最大値に対して十分小さく、画面上で見分けがつかない大きさにした */
export const DEFAULT_EPSILON = 0.01;

/** ε の下限。これより小さいと浮動小数点の計算誤差と区別できなくなる */
export const MIN_EPSILON = 0.0001;

/** ε の上限。これより大きいと近接する別の頂点まで同一視してしまう */
export const MAX_EPSILON = 1;

/** 座標の絶対値の上限。ε との桁差を保ち、頂点の併合後に近接を再検査しなくてよい前提にする */
export const MAX_COORDINATE = 100000;

/** 基礎矩形の幅と高さの既定値 */
export const DEFAULT_RECT_SIZE = 1000;

/** 基礎矩形の幅と高さの下限 */
export const MIN_RECT_SIZE = 10;

/** 基礎矩形の幅と高さの上限 */
export const MAX_RECT_SIZE = 10000;

/** グリッドスナップが有効かの既定値 */
export const DEFAULT_SNAP_ENABLED = true;

/** グリッドスナップの刻みの既定値。既定の矩形（1000）を 100 分割する大きさ */
export const DEFAULT_SNAP_STEP = 10;

/** グリッドスナップの刻みの下限 */
export const MIN_SNAP_STEP = 0.1;

/** グリッドスナップの刻みの上限 */
export const MAX_SNAP_STEP = 1000;
