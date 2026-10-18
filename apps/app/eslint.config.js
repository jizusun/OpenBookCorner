// Focused ESLint config: ONLY the high-signal Lingui rules, scoped to UI source.
//
// The project linter is oxlint (see .oxlintrc.json / `bun run lint`). oxlint has
// no native Lingui rules, so this standalone config runs eslint-plugin-lingui to
// catch the i18n mistakes that actually matter at author time + in CI:
//
//   - t-call-in-function (ERROR): `t\`...\`` used at module scope won't react to
//     locale switching — a real bug.
//   - no-trans-inside-trans (ERROR): nested <Trans> produces broken catalogs.
//   - no-expression-in-message (WARN): expressions extract to {0} and starve
//     translators of context (use a named placeholder instead).
//   - no-single-variables-to-translate (WARN): `<Trans>{x}</Trans>` has nothing
//     to translate.
//
// We deliberately DO NOT enable `no-unlocalized-strings` here: it fires on every
// non-UI literal (test ids, enum values, demo emails, ISBN placeholders, API
// constants) and produced ~220 false positives. The CI translation checks
// (extract-sync + missing-msgstr + `compile --strict`) already guarantee no
// untranslated string ships, so that rule's cost outweighs its benefit for us.
//
// Run via `bun run i18n:lint`. Kept separate from oxlint so we don't convert the
// whole repo onto ESLint for one plugin.
import lingui from 'eslint-plugin-lingui'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/routeTree.gen.ts',
      'lib/i18n/locales/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
    ],
  },
  {
    files: ['routes/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'index.tsx'],
    plugins: { lingui },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // Not type-aware — keeps this check fast and avoids needing a tsconfig
        // project graph just for the Lingui rules.
      },
    },
    rules: {
      'lingui/t-call-in-function': 'error',
      'lingui/no-trans-inside-trans': 'error',
      'lingui/no-expression-in-message': 'warn',
      'lingui/no-single-variables-to-translate': 'warn',
    },
  },
]
