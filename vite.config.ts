import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/**
 * 環境変数 BASE_PATH から paths.base の値を作る
 *
 * GitHub Pages ではサブパス（/polyline-partition）で配信されるため、本番ビルドだけ値を渡す。
 * 未指定または先頭が / でない値は、開発時と同じ空文字として扱う。
 */
function toBasePath(value: string | undefined): '' | `/${string}` {
	if (value === undefined || !value.startsWith('/')) return '';
	// 先頭が / であることを上で確認済みなので、テンプレートリテラル型に合わせる
	return value as `/${string}`;
}

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			paths: { base: toBasePath(process.env.BASE_PATH) },
			compilerOptions: {
				// プロジェクト全体を runes モードに固定する（ライブラリは除く）
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			}
		})
	]
});
