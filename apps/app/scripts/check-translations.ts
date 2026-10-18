/**
 * CI guard: fail if any non-source locale has untranslated (empty `msgstr`)
 * entries in its PO catalog. Lingui auto-generates message IDs from the English
 * source, so editing a source string resets its translation to "missing" — this
 * catches that before it ships.
 *
 * Pair this with a sync check in CI (`lingui extract --clean` + `git diff
 * --exit-code` on the .po files) so added `<Trans>` strings must be extracted.
 *
 * Run: `bun run scripts/check-translations.ts`
 * Exit code 1 if any locale has missing translations.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = join(here, '..', 'lib', 'i18n', 'locales')

// Source locale needs no translations (msgid IS the message).
const SOURCE_LOCALE = 'en'
const LOCALES = ['en', 'zh']

/**
 * Minimal PO reader: returns the number of entries whose msgstr is empty
 * (ignoring the header entry, whose msgid is "").
 */
function countMissing(poPath: string): { total: number; missing: string[] } {
  const text = readFileSync(poPath, 'utf8')
  const blocks = text.split(/\n\n+/)
  const missing: string[] = []
  let total = 0

  for (const block of blocks) {
    const idMatch = block.match(/^msgid "((?:[^"\\]|\\.)*)"/m)
    const strMatch = block.match(/^msgstr "((?:[^"\\]|\\.)*)"/m)
    if (!idMatch || !strMatch) continue
    const id = idMatch[1]!
    if (id === '') continue // header
    total++
    // `msgstr ""` may be followed by continuation lines ("..."). The entry is
    // translated if the first-line content is non-empty OR any continuation
    // line has content.
    const firstLineHasContent = strMatch[1] !== ''
    const continuationHasContent = /^msgstr ""\n(?:"(?:[^"\\]|\\.)*"\n?)*"(?:[^"\\]|\\.)*[^"\s\\](?:[^"\\]|\\.)*"/m.test(
      block,
    )
    if (!firstLineHasContent && !continuationHasContent) missing.push(id)
  }
  return { total, missing }
}

let failed = false
for (const locale of LOCALES) {
  if (locale === SOURCE_LOCALE) continue
  const poPath = join(localesDir, `${locale}.po`)
  if (!existsSync(poPath)) {
    console.error(`✗ ${locale}: catalog not found at ${poPath}`)
    failed = true
    continue
  }
  const { total, missing } = countMissing(poPath)
  if (missing.length > 0) {
    failed = true
    console.error(`✗ ${locale}: ${missing.length}/${total} messages missing a translation:`)
    for (const id of missing.slice(0, 20)) console.error(`    - ${JSON.stringify(id)}`)
    if (missing.length > 20) console.error(`    … and ${missing.length - 20} more`)
  } else {
    console.log(`✓ ${locale}: all ${total} messages translated`)
  }
}

if (failed) {
  console.error('\nTranslation check failed. Run `bun --cwd apps/app i18n:extract`, translate the')
  console.error('missing entries in lib/i18n/locales/*.po, then commit.')
  process.exit(1)
}
console.log('\nAll locales fully translated.')
