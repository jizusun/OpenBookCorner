import { Hono } from 'hono'

import { adminApp } from './admin'
import { authApp } from './auth'
import { bookApp } from './book'
import { borrowingApp } from './borrowing'
import { feedbackApp } from './feedback'
import { libraryApp } from './library'
import { memberApp } from './member'
import { membershipApp } from './membership'
import { tenantApp } from './tenant'

/**
 * The composed Hono API. Each concern is a chained sub-app with its own guards
 * attached at the sub-app level (see lib/mw.ts). Mounted by the Worker under
 * `/api`. `type Api` is consumed by the frontend `hc<Api>` client for
 * end-to-end type safety, so the routes are composed in a single chained
 * expression (required for hc inference).
 */
export const apiApp = new Hono()
  .route('/session', authApp)
  .route('/book', bookApp)
  .route('/borrowing', borrowingApp)
  .route('/library', libraryApp)
  .route('/member', memberApp)
  .route('/membership', membershipApp)
  .route('/feedback', feedbackApp)
  .route('/tenant', tenantApp)
  .route('/admin', adminApp)

export type Api = typeof apiApp
