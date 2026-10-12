import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/** 意味が自明で、名前付き定数にしなくてよい数値 */
const ALLOWED_NUMBERS = [0, 1, -1, 2];

/** max-depth の上限（AGENTS.md 4.2 の「3段を超えない」） */
const MAX_NESTING_DEPTH = 3;

/** 規約（AGENTS.md 4.7）で、ドキュメントコメントを必須にする対象 */
const JSDOC_REQUIRED_CONTEXTS = [
	'TSTypeAliasDeclaration',
	'TSPropertySignature',
	'PropertyDefinition',
	'ExportNamedDeclaration'
];

export default ts.config(
	{ ignores: ['.svelte-kit/', 'build/', 'node_modules/', 'src/lib/components/ui/'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'max-depth': ['error', MAX_NESTING_DEPTH],
			'no-magic-numbers': 'off',
			'@typescript-eslint/no-magic-numbers': [
				'error',
				{ ignore: ALLOWED_NUMBERS, ignoreEnums: true, ignoreTypeIndexes: true }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['**/*.ts'],
		ignores: [
			'**/*.test.ts',
			'**/*.spec.ts',
			'playwright.config.ts',
			'src/lib/utils.ts',
			'src/app.d.ts'
		],
		plugins: { jsdoc },
		rules: {
			'jsdoc/require-jsdoc': [
				'error',
				{
					require: {
						FunctionDeclaration: true,
						ClassDeclaration: true,
						MethodDefinition: true
					},
					contexts: JSDOC_REQUIRED_CONTEXTS
				}
			]
		}
	}
);
