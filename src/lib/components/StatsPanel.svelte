<script lang="ts">
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/**
	 * 検算の結果を表示用の文字列にする
	 *
	 * @param value 検算の結果。検算できないときは null
	 * @returns 表示用の文字列
	 */
	function checkLabel(value: boolean | null): string {
		if (value === null) return '対象外';
		return value ? '成立' : '不一致';
	}
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">統計</h2>
	<dl class="grid grid-cols-2 gap-x-2 text-sm">
		<dt>ポリライン本数</dt>
		<dd data-testid="stat-polylines">{editor.document.polylines.length}</dd>
		<dt>区画数</dt>
		<dd data-testid="stat-regions">
			{editor.result === null ? '未分割' : editor.result.stats.regionCount}
		</dd>
	</dl>
	{#if editor.result !== null}
		{@const stats = editor.result.stats}
		<Collapsible.Root>
			<Collapsible.Trigger>
				{#snippet child({ props })}
					<Button variant="ghost" size="sm" {...props}>詳細</Button>
				{/snippet}
			</Collapsible.Trigger>
			<Collapsible.Content>
				<dl class="grid grid-cols-2 gap-x-2 text-sm" data-testid="stat-details">
					<dt>弦数</dt>
					<dd>{stats.chordCount}</dd>
					<dt>交点数</dt>
					<dd>{stats.intersectionCount}</dd>
					<dt>破棄した微小面数</dt>
					<dd>{stats.discardedFaceCount}</dd>
					<dt>オイラーの公式</dt>
					<dd>{checkLabel(stats.checks.euler)}</dd>
					<dt>弦・交点の式</dt>
					<dd>{checkLabel(stats.checks.chordFormula)}</dd>
					<dt>面積の総和</dt>
					<dd>{checkLabel(stats.checks.areaSum)}</dd>
				</dl>
			</Collapsible.Content>
		</Collapsible.Root>
	{/if}
</section>
