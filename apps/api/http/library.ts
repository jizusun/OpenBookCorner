import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant, tenantHostGuard } from '../lib/mw'
import { LibraryService } from '../services'
import { AuditService } from '../services/audit'
import {
  FanshuImportService,
  fetchFanshuWorkbook,
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

/** Library settings + 番薯 import. Settings read = member; writes = admin. */
export const libraryApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenantHostGuard, tenant)
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
  .post(
    '/import/url',
    admin,
    zValidator('json', z.object({ url: z.string().url(), preview: z.boolean().optional() })),
    async (c) => {
      const { url, preview } = c.req.valid('json')
      const sheets = await fetchFanshuWorkbook(url)
      return c.json(
        preview
          ? await previewFanshuImport(c.get('libraryId'), sheets)
          : await new FanshuImportService(c.get('db')).import(c.get('libraryId'), sheets, {
              sourceUrl: url,
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
