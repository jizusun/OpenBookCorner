import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { FeedbackService } from '../services'

const submitBody = z.object({
  category: z.enum(['feature_request', 'bug', 'book_suggestion', 'other']),
  message: z.string().min(1).max(2000),
})

/** Feedback: any member can submit; admin can list. Tenant-scoped. */
export const feedbackApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant)
  .post('/', zValidator('json', submitBody), (c) =>
    c.json(
      new FeedbackService(c.get('db')).submit({
        libraryId: c.get('libraryId'),
        userId: c.get('user').id,
        category: c.req.valid('json').category,
        message: c.req.valid('json').message,
      }),
    ),
  )
  .get('/', admin, (c) => c.json(new FeedbackService(c.get('db')).listByLibrary(c.get('libraryId'))))
