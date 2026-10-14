# Conventions (詳細は AGENTS.md が正)

- 言語: コメント・コミット・Issue/PR は日本語、識別子は英語。人間向け文章は事実/推論を分け、技術用語は原語+初出で平易な説明、長い報告は先頭3行要約。
- TSDoc 必須（関数、クラス、フィールド、型、エクスポート定数、`$state`/`$props`）。1行目は体言止め・句点なし、真偽値は「〜か」で終える。`@param/@returns` は名前から不明なときだけ。インラインコメントは「なぜ」のみ。
- TS strict: `any`・`!`・`export default`・`enum` 禁止、`as` は理由コメント付き最小限。データは `readonly`・非破壊。想定内の失敗は判別共用体 `{ok:true,value}|{ok:false,reason}`、例外は想定外のみ。
- ネスト≤2(上限3)、早期リターン、関数≤40行・引数≤3、マジックナンバーは `constants.ts`（0,1,-1,2 は可）、真偽値名は is/has/can。
- Svelte コンポーネントにロジックを書かない。汎用 UI は shadcn-svelte を使い自作しない。props は型+TSDoc。
- Svelte ファイルは確定前に `svelte-autofixer`(MCP) で検査。API に自信がなければ MCP ドキュメント検索。
- テスト: `describe(対象) > describe(正常系|異常系|境界条件) > it(日本語)` の3段。1テスト1観点、AAA、乱数はシード固定、バグ修正は再現テスト先行。
- Prettier はタブインデント、コミット type は feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert。scope 例: geometry, ui, io, settings, e2e。
