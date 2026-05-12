// Flat config (ESLint 9+). Run `npm run lint` / `npm run lint:fix`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import globals from "globals";

export default [
	{
		ignores: [
			"dist/",
			".astro/",
			"node_modules/",
			"public/",
			"worker-configuration.d.ts",
			"package-lock.json",
		],
	},

	js.configs.recommended,
	...tseslint.configs.recommended,
	...astro.configs.recommended,

	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			// Anti-slop: dead/unused code AI tends to leave behind.
			// `_`-prefixed names are an intentional opt-out for catch params and stubs.
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
				},
			],
			"no-unused-vars": "off",

			// Anti-slop: leftover debug logging.
			"no-console": ["warn", { allow: ["warn", "error"] }],

			// Anti-slop: useless error handling AI loves to generate.
			"no-useless-catch": "error",
			"no-empty": ["error", { allowEmptyCatch: false }],

			// Anti-slop: typing escape hatches.
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-non-null-assertion": "warn",
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" },
			],

			// Standard hygiene.
			"prefer-const": "error",
			"no-var": "error",
			eqeqeq: ["error", "always", { null: "ignore" }],
			"no-implicit-coercion": "warn",
		},
	},

	{
		files: ["**/*.astro"],
		rules: {
			// Frontmatter often defines variables only used in the template;
			// the Astro plugin's own no-unused-vars handles those cases better.
			"@typescript-eslint/no-unused-vars": "off",
		},
	},

	{
		files: ["**/*.js", "**/*.mjs"],
		rules: {
			// Plain JS files (e.g. astro.config.mjs, rss.xml.js) don't get TS rules.
			"@typescript-eslint/no-explicit-any": "off",
		},
	},

	{
		files: ["**/*.d.ts"],
		rules: {
			// Ambient declaration files use idioms (import() types, empty
			// extending interfaces for module augmentation) that the standard
			// presets flag in regular source but are correct here.
			"@typescript-eslint/consistent-type-imports": "off",
			"@typescript-eslint/no-empty-object-type": "off",
		},
	},
];
