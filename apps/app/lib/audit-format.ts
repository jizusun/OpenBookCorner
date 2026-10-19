/**
 * Pure helpers for the system audit log page (super-admin console).
 *
 * These are framework-free and DO NOT translate: i18n lives in the component
 * (real lingui macros, which the extractor can see). The pure logic under test
 * is classifying an action into a known kind (with a fallback), the
 * impersonation flag, target placeholder, and time formatting.
 */

/** One audit row as returned by GET /api/tenant/audit (JSON shape). */
export interface AuditRow {
  id: string
  actorUserId: string
  onBehalfOfUserId: string | null
  libraryId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

/** Known audit action kinds (plus `unknown` fallback). */
export type AuditActionKind =
  | 'impersonation.start'
  | 'impersonation.stop'
  | 'tenant.create'
  | 'tenant.setActive'
  | 'tenant.update'
  | 'tenant.delete'
  | 'unknown'

const KNOWN: ReadonlySet<string> = new Set([
  'impersonation.start',
  'impersonation.stop',
  'tenant.create',
  'tenant.setActive',
  'tenant.update',
  'tenant.delete',
])

/** Classify a raw action string into a known kind, or 'unknown'. */
export function auditActionKind(action: string): AuditActionKind {
  return KNOWN.has(action) ? (action as AuditActionKind) : 'unknown'
}

/** Display model consumed by the audit table (localization done in the view). */
export interface AuditRowView {
  id: string
  action: string
  kind: AuditActionKind
  actorUserId: string
  onBehalfOf: string | null
  isImpersonation: boolean
  targetDisplay: string
  targetId: string | null
  time: string
  hasMetadata: boolean
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Map a raw audit row to its display model. Localization happens in the view. */
export function formatAuditRow(row: AuditRow): AuditRowView {
  const onBehalfOf = row.onBehalfOfUserId ?? null
  return {
    id: row.id,
    action: row.action,
    kind: auditActionKind(row.action),
    actorUserId: row.actorUserId,
    onBehalfOf,
    isImpersonation: onBehalfOf !== null,
    targetDisplay: row.targetId ?? '—',
    targetId: row.targetId ?? null,
    time: formatTime(row.createdAt),
    hasMetadata: row.metadata != null && Object.keys(row.metadata).length > 0,
  }
}
