/**
 * Pure helpers for the system audit log page (super-admin console).
 *
 * These are framework-free and DO NOT translate: i18n lives in the component
 * (real lingui macros, which the extractor can see). The pure logic under test
 * is classifying an action into a known kind (with a fallback), the
 * impersonation flag, target placeholder, and time formatting.
 */

/** One audit row as returned by the audit endpoints (JSON shape). The *Name
 *  fields are resolved server-side (join on user) so the UI can show names
 *  instead of raw ids; they may be null when the id is not a known user. */
export interface AuditRow {
  id: string
  actorUserId: string
  actorName?: string | null
  onBehalfOfUserId: string | null
  onBehalfOfName?: string | null
  libraryId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  targetName?: string | null
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
  actorName: string | null
  onBehalfOf: string | null
  onBehalfOfName: string | null
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
    actorName: row.actorName ?? null,
    onBehalfOf,
    onBehalfOfName: row.onBehalfOfName ?? null,
    isImpersonation: onBehalfOf !== null,
    // Prefer a resolved name; fall back to the id, then a placeholder.
    targetDisplay: row.targetName ?? row.targetId ?? '—',
    targetId: row.targetId ?? null,
    time: formatTime(row.createdAt),
    hasMetadata: row.metadata != null && Object.keys(row.metadata).length > 0,
  }
}
