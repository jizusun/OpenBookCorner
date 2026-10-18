import { defineConfig } from '@lingui/conf'

/**
 * Lingui config — macro + extract/compile workflow.
 *
 * Source locale is `en`: messages are authored inline in the code via Lingui
 * macros (`<Trans>Welcome back</Trans>`, `` t`...` ``). `lingui extract` pulls
 * them into PO catalogs; translators fill `zh.po`; `lingui compile` emits the
 * runtime catalogs. The Vite plugin (macroTransform) compiles catalogs on the
 * fly in dev and transforms the macros, so no separate Babel/SWC step is needed.
 */
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh'],
  catalogs: [
    {
      path: '<rootDir>/lib/i18n/locales/{locale}',
      include: ['<rootDir>/routes', '<rootDir>/components', '<rootDir>/lib'],
      exclude: ['**/node_modules/**', '**/*.test.*'],
    },
  ],
  format: 'po',
})
