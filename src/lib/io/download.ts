/**
 * 文字列をファイルとしてダウンロード
 *
 * ブラウザのダウンロード機能を使うので、DOM のあるブラウザでだけ呼べる。
 *
 * @param fileName 保存するファイル名
 * @param content ファイルの内容
 * @param mimeType ファイルの MIME タイプ
 */
export function downloadText(fileName: string, content: string, mimeType: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
}
