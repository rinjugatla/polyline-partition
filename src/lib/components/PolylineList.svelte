<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/** 無効なポリラインの ID の集合 */
	const invalidIds = $derived(new Set(editor.invalidPolylines.map((entry) => entry.polylineId)));
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">ポリライン一覧</h2>
	{#if editor.document.polylines.length === 0}
		<p class="text-xs text-muted-foreground">ポリラインはありません</p>
	{:else}
		<ul class="space-y-1" data-testid="polyline-list">
			{#each editor.document.polylines as polyline (polyline.id)}
				<li
					class="flex items-center gap-2 rounded border px-2 py-1 text-sm {polyline.id ===
					editor.selectedId
						? 'border-blue-600'
						: ''}"
				>
					<button type="button" class="flex-1 text-left" onclick={() => editor.select(polyline.id)}>
						{polyline.id}（{polyline.vertices.length}頂点）
					</button>
					<span
						class={invalidIds.has(polyline.id)
							? 'text-xs text-red-600'
							: 'text-xs text-muted-foreground'}
					>
						{invalidIds.has(polyline.id) ? '無効' : '有効'}
					</span>
					<Button
						variant="ghost"
						size="sm"
						aria-label="{polyline.id} を削除"
						onclick={() => editor.deletePolyline(polyline.id)}>削除</Button
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>
