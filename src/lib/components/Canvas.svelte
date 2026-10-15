<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		CANVAS_STROKE_WIDTH,
		CURSOR_DECIMALS,
		DRAFT_DASH_PATTERN,
		HANDLE_RADIUS,
		SELECTED_STROKE_WIDTH,
		ZOOM_STEP
	} from '#lib/constants.js';
	import type { Point } from '#lib/geometry/types.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';
	import { resolveKeyAction } from '#lib/state/keyboard.js';
	import {
		fitViewport,
		panBy,
		toLogical,
		toScreen,
		zoomAt,
		type Viewport
	} from '#lib/state/viewport.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/** キャンバスの幅（ピクセル） */
	let width = $state(0);

	/** キャンバスの高さ（ピクセル） */
	let height = $state(0);

	/** 利用者がズームやパンで動かした表示と、そのときの全体表示の条件 */
	let manual = $state.raw<{ readonly view: Viewport; readonly key: string } | null>(null);

	/** カーソル位置の論理座標。キャンバスの外では null */
	let cursor = $state.raw<Point | null>(null);

	/** 中ボタンでパン中か */
	let isPanning = $state(false);

	/** SVG 要素 */
	let svg = $state<SVGSVGElement | null>(null);

	/** 全体表示の位置と倍率 */
	const fit = $derived(
		width > 0 && height > 0 ? fitViewport(editor.document.rect, { width, height }) : null
	);

	/** 全体表示の条件（キャンバスの大きさと矩形の大きさ）。変わったら動かした表示は捨てる */
	const fitKey = $derived(
		`${width},${height},${editor.document.rect.width},${editor.document.rect.height}`
	);

	/** 実際に使う表示（動かしていない、または条件が変わったときは全体表示） */
	const view = $derived(manual !== null && manual.key === fitKey ? manual.view : fit);

	/** 無効なポリラインの ID の集合 */
	const invalidIds = $derived(new Set(editor.invalidPolylines.map((entry) => entry.polylineId)));

	/**
	 * 論理座標の列を SVG の points 属性にする
	 *
	 * @param points 論理座標の列
	 * @returns スクリーン座標の points 文字列
	 */
	function toPoints(points: readonly Point[]): string {
		if (view === null) return '';
		return points
			.map((point) => {
				const screen = toScreen(view, point);
				return `${screen.x},${screen.y}`;
			})
			.join(' ');
	}

	/**
	 * ポインターイベントの位置を論理座標にする
	 *
	 * @param event ポインターイベント
	 * @returns 論理座標。表示が未確定なら null
	 */
	function logicalOf(event: PointerEvent | MouseEvent): Point | null {
		if (view === null || svg === null) return null;
		const box = svg.getBoundingClientRect();
		return toLogical(view, { x: event.clientX - box.left, y: event.clientY - box.top });
	}

	/**
	 * カーソルの位置をスナップと軸拘束で補正する
	 *
	 * @param event ポインターイベント
	 * @param axisBase 軸拘束の基準の頂点
	 * @returns 補正後の論理座標
	 */
	function resolved(event: PointerEvent | MouseEvent, axisBase: Point | null): Point | null {
		const point = logicalOf(event);
		return point === null ? null : editor.resolvePoint(point, event.shiftKey, axisBase);
	}

	/**
	 * ポインターが動いたときの処理
	 *
	 * @param event ポインターイベント
	 */
	function handleMove(event: PointerEvent): void {
		if (isPanning && view !== null) {
			manual = { view: panBy(view, event.movementX, event.movementY), key: fitKey };
			return;
		}
		cursor = logicalOf(event);
		editor.moveCursor(cursor, event.shiftKey);
	}

	/**
	 * ポインターが押されたときの処理
	 *
	 * @param event ポインターイベント
	 */
	function handleDown(event: PointerEvent): void {
		if (event.button === 1) {
			isPanning = true;
			svg?.setPointerCapture(event.pointerId);
			event.preventDefault();
			return;
		}
		if (event.button !== 0) return;
		if (editor.mode === 'select') {
			editor.select(null);
			return;
		}
		const point = resolved(event, editor.draftAxisBase());
		if (point !== null) editor.addDraftVertex(point);
	}

	/** ポインターが離されたときの処理 */
	function handleUp(): void {
		isPanning = false;
		editor.endDrag();
	}

	/**
	 * ホイールでズームする
	 *
	 * @param event ホイールイベント
	 */
	function handleWheel(event: WheelEvent): void {
		if (view === null || fit === null || svg === null) return;
		const box = svg.getBoundingClientRect();
		const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
		manual = {
			view: zoomAt(
				view,
				{ x: event.clientX - box.left, y: event.clientY - box.top },
				factor,
				fit.scale
			),
			key: fitKey
		};
	}

	/**
	 * ポリラインを選択する
	 *
	 * @param event ポインターイベント
	 * @param id 選択するポリラインの ID
	 */
	function handlePolylineDown(event: PointerEvent, id: string): void {
		if (editor.mode !== 'select' || event.button !== 0) return;
		event.stopPropagation();
		editor.select(id);
	}

	/**
	 * 頂点のドラッグを始める
	 *
	 * @param event ポインターイベント
	 * @param index 頂点の添字
	 */
	function handleHandleDown(event: PointerEvent, index: number): void {
		const id = editor.selectedId;
		if (event.button !== 0 || id === null) return;
		event.stopPropagation();
		svg?.setPointerCapture(event.pointerId);
		editor.beginDrag(id, index);
	}

	/**
	 * キー操作を処理する
	 *
	 * @param event キーボードイベント
	 */
	function handleKey(event: KeyboardEvent): void {
		const target = event.target;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
		const action = resolveKeyAction({
			key: event.key,
			isCtrl: event.ctrlKey || event.metaKey,
			isShift: event.shiftKey,
			mode: editor.mode
		});
		if (action === null) return;
		// ブラウザ標準の Undo / Redo と二重に動かさない
		if (action === 'undo' || action === 'redo') event.preventDefault();
		editor.applyKeyAction(action);
	}
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="relative size-full overflow-hidden bg-muted/40"
	bind:clientWidth={width}
	bind:clientHeight={height}
>
	{#if view !== null}
		<svg
			bind:this={svg}
			data-testid="canvas"
			role="application"
			aria-label="キャンバス"
			class="size-full touch-none select-none {editor.mode === 'draw' ? 'cursor-crosshair' : ''}"
			onpointerdown={handleDown}
			onpointermove={handleMove}
			onpointerup={handleUp}
			onpointerleave={() => (cursor = null)}
			ondblclick={() => editor.mode === 'draw' && editor.finishDraft()}
			onwheel={handleWheel}
		>
			<polygon
				points={toPoints([
					{ x: 0, y: 0 },
					{ x: editor.document.rect.width, y: 0 },
					{ x: editor.document.rect.width, y: editor.document.rect.height },
					{ x: 0, y: editor.document.rect.height }
				])}
				class="fill-background stroke-foreground"
				stroke-width={CANVAS_STROKE_WIDTH}
				data-testid="rect-frame"
			/>

			{#if editor.result !== null}
				{#each editor.result.regions as region, index (region.id)}
					<polygon
						points={toPoints(region.polygon)}
						fill={editor.colors[index]}
						class="stroke-background/60"
						data-testid="region"
					/>
				{/each}
			{/if}

			{#each editor.document.polylines as polyline (polyline.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<polyline
					points={toPoints(polyline.vertices)}
					fill="none"
					stroke-width={polyline.id === editor.selectedId
						? SELECTED_STROKE_WIDTH
						: CANVAS_STROKE_WIDTH}
					class={invalidIds.has(polyline.id)
						? 'stroke-red-600'
						: polyline.id === editor.selectedId
							? 'stroke-blue-600'
							: 'stroke-foreground'}
					data-testid="polyline"
					data-invalid={invalidIds.has(polyline.id)}
					onpointerdown={(event) => handlePolylineDown(event, polyline.id)}
				/>
			{/each}

			{#each editor.selectedPolyline?.vertices ?? [] as vertex, index (index)}
				{@const screen = toScreen(view, vertex)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<circle
					cx={screen.x}
					cy={screen.y}
					r={HANDLE_RADIUS}
					class="cursor-move fill-background stroke-blue-600"
					stroke-width={CANVAS_STROKE_WIDTH}
					data-testid="vertex-handle"
					onpointerdown={(event) => handleHandleDown(event, index)}
				/>
			{/each}

			{#if editor.mode === 'draw' && editor.draft.length > 0}
				<polyline
					points={toPoints(
						editor.previewPoint === null ? editor.draft : [...editor.draft, editor.previewPoint]
					)}
					fill="none"
					stroke-width={CANVAS_STROKE_WIDTH}
					stroke-dasharray={DRAFT_DASH_PATTERN}
					class={editor.message === null ? 'stroke-blue-600' : 'stroke-red-600'}
					data-testid="draft"
				/>
			{/if}
		</svg>
	{/if}

	<div
		class="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs"
		data-testid="cursor-position"
	>
		{cursor === null
			? '—'
			: `x: ${cursor.x.toFixed(CURSOR_DECIMALS)}, y: ${cursor.y.toFixed(CURSOR_DECIMALS)}`}
	</div>

	<div class="absolute top-2 right-2">
		<Button variant="outline" size="sm" onclick={() => (manual = null)}>全体表示</Button>
	</div>
</div>
