import { Trans } from '@lingui/react/macro'
import { isDemoVisible, type AppConfig } from '@/lib/config'

export interface SystemInfoProps {
  config: AppConfig | null
}

/**
 * Read-only system information for the super-admin console (no writable settings
 * this iteration — see docs/super-admin-console.md). Pure presentation of the
 * runtime environment, demo-account visibility (derived, not a toggle), and the
 * tenancy model. Tenant-level settings live on each tenant's detail page.
 */
export function SystemInfo({ config }: SystemInfoProps) {
  const env = config?.environment || '—'
  const demoVisible = isDemoVisible(config)

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border p-4">
        <dt className="text-sm text-muted-foreground">
          <Trans>Environment</Trans>
        </dt>
        <dd className="mt-1 font-medium" data-testid="sys-environment">
          {env}
        </dd>
      </div>

      <div className="rounded-md border p-4">
        <dt className="text-sm text-muted-foreground">
          <Trans>Demo accounts</Trans>
        </dt>
        <dd className="mt-1 font-medium" data-testid="sys-demo-visible" data-visible={String(demoVisible)}>
          {demoVisible ? <Trans>Visible (non-production)</Trans> : <Trans>Hidden</Trans>}
        </dd>
      </div>

      <div className="rounded-md border p-4 sm:col-span-2">
        <dt className="text-sm text-muted-foreground">
          <Trans>Tenancy model</Trans>
        </dt>
        <dd className="mt-1" data-testid="sys-tenancy">
          <Trans>Path-based — each tenant is served at /t/:slug</Trans>
        </dd>
        <p className="mt-2 text-sm text-muted-foreground">
          <Trans>Per-tenant settings live on each tenant's detail page.</Trans>
        </p>
      </div>
    </dl>
  )
}
