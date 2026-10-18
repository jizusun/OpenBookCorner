import { router } from './trpc'
import { authRouter } from '../routers/auth'
import { bookRouter } from '../routers/book'
import { borrowingRouter } from '../routers/borrowing'
import { feedbackRouter } from '../routers/feedback'
import { libraryRouter } from '../routers/library'
import { memberRouter } from '../routers/member'
import { tenantRouter } from '../routers/tenant'

/** The composed tRPC router — the whole backend API surface. */
export const appRouter = router({
  auth: authRouter,
  book: bookRouter,
  borrowing: borrowingRouter,
  library: libraryRouter,
  member: memberRouter,
  feedback: feedbackRouter,
  tenant: tenantRouter,
})

export type AppRouter = typeof appRouter
