import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { LibraryService } from '../services'
import { AuditService } from '../services/audit'
import {
  FanshuImportService,
  fetchFanshuWorkbook,
  parseFanshuWorkbook,
  previewFanshuImport,
} from '../services/fanshuImport'

const sheet = z.array(z.record(z.string(), z.unknown())).max(10000)
const fanshuSheets = z.object({
  books: sheet,
  stock: sheet,
  members: sheet,
  loans: sheet,
  reviews: sheet,
  purchaseRequests: sheet,
})

const updateSettingsBody = z.object({
  name: z.string().min(1),
  borrowingPeriodDays: z.number().int().min(1).max(365),
  maxBooksPerReader: z.number().int().min(1).max(100),
  allowExtensions: z.boolean(),
})

/** Upload the raw import file to R2 and return the key. Silently returns null on failure. */
async function storeImportFile(
  r2: R2Bucket | undefined,
  libraryId: string,
  fileName: string,
  bytes: ArrayBuffer,
): Promise<string | null> {
  if (!r2) return null
  try {
    const ts = Date.now()
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const key = `imports/fanshu/${libraryId}/${ts}-${safe}`
    await r2.put(key, bytes, {
      httpMetadata: { contentType: 'application/vnd.ms-excel' },
      customMetadata: { libraryId, importedAt: new Date().toISOString() },
    })
    return key
  } catch {
    return null
  }
}

/** Library settings + 番薯 import. Settings read = member; writes = admin. */
export const libraryApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant)
  .get('/settings', async (c) => {
    const lib = await new LibraryService(c.get('db')).get(c.get('libraryId'))
    if (!lib) return c.json({ error: 'LIBRARY_NOT_FOUND' }, 404)
    return c.json({ name: lib.name, emailDomains: lib.emailDomains, settings: lib.settings })
  })
  .put('/settings', admin, zValidator('json', updateSettingsBody), async (c) => {
    const res = await new LibraryService(c.get('db')).updateSettings(
      c.get('libraryId'),
      c.req.valid('json'),
    )
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: c.get('libraryId'),
      action: 'library.updateSettings',
      targetType: 'library',
      targetId: c.get('libraryId'),
    })
    return c.json(res)
  })
  .post('/import/preview', admin, zValidator('json', z.object({ sheets: fanshuSheets })), async (c) =>
    c.json(await previewFanshuImport(c.get('libraryId'), c.req.valid('json').sheets)),
  )
  // Legacy JSON-sheets import (browser-parsed). Still supported but r2Key will be null.
  .post(
    '/import',
    admin,
    zValidator('json', z.object({ sheets: fanshuSheets, fileName: z.string().optional() })),
    async (c) =>
      c.json(
        await new FanshuImportService(c.get('db')).import(
          c.get('libraryId'),
          c.req.valid('json').sheets,
          {
            fileName: c.req.valid('json').fileName,
            ranByUserId: c.get('user').id,
          },
        ),
      ),
  )
  // Preferred: multipart file upload — parses XLS server-side and archives the
  // original file to R2 under imports/fanshu/{libraryId}/{ts}-{fileName}.
  .post('/import/file', admin, async (c) => {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'FILE_REQUIRED' }, 400)
    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > 20 * 1024 * 1024) return c.json({ error: 'FILE_TOO_LARGE' }, 400)
    // Archive the raw file to R2 first.
    const r2Key = await storeImportFile(c.get('env').COVERS, c.get('libraryId'), file.name, bytes)
    // Parse + import.
    const sheets = await parseFanshuWorkbook(new Uint8Array(bytes))
    const counts = await new FanshuImportService(c.get('db')).import(
      c.get('libraryId'),
      sheets,
      { fileName: file.name, r2Key: r2Key ?? undefined, ranByUserId: c.get('user').id },
    )
    return c.json({ ...counts, r2Key })
  })
  .post(
    '/import/url',
    admin,
    zValidator('json', z.object({ url: z.string().url(), preview: z.boolean().optional() })),
    async (c) => {
      const { url, preview } = c.req.valid('json')
      // For preview: use the existing fetchFanshuWorkbook (no need to buffer for R2).
      if (preview) {
        const sheets = await fetchFanshuWorkbook(url)
        return c.json(await previewFanshuImport(c.get('libraryId'), sheets))
      }
      // Full import: fetch raw bytes, archive to R2, then parse + import.
      const fileName = url.split('/').pop() ?? 'import.xls'
      const res = await fetch(url)
      if (!res.ok) return c.json({ error: 'FETCH_FAILED' }, 400)
      const bytes = await res.arrayBuffer()
      if (bytes.byteLength > 20 * 1024 * 1024) return c.json({ error: 'FILE_TOO_LARGE' }, 400)
      const r2Key = await storeImportFile(c.get('env').COVERS, c.get('libraryId'), fileName, bytes)
      const sheets = await parseFanshuWorkbook(new Uint8Array(bytes))
      return c.json(
        await new FanshuImportService(c.get('db')).import(c.get('libraryId'), sheets, {
          sourceUrl: url,
          fileName,
          r2Key: r2Key ?? undefined,
          ranByUserId: c.get('user').id,
        }),
      )
    },
  )
  .get('/import/history', admin, async (c) =>
    c.json(await new FanshuImportService(c.get('db')).listRuns(c.get('libraryId'))),
  )
  .get('/audit', admin, async (c) =>
    c.json(await new AuditService(c.get('db')).listByLibrary(c.get('libraryId'))),
  )
