/**
 * Slim top progress bar shown during route transitions (lazy route-chunk
 * download + loader) via the router's defaultPendingComponent. The app shell
 * (header/nav) stays visible — only this bar animates — so navigation feels
 * responsive without a jarring full-screen flash. Content skeletons then take
 * over once the route mounts.
 */
import { useI18n } from '@/lib/i18n'

export function RouteProgress() {
  const { t } = useI18n()
  return (
    <div
      role="status"
      aria-label={t('common.loadingAria')}
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-primary/20"
      data-testid="route-progress"
    >
      <div className="obc-progress h-full w-1/3 bg-primary" />
      <style>{`
        @keyframes obc-progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .obc-progress { animation: obc-progress-slide 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .obc-progress { animation-duration: 2.4s; }
        }
      `}</style>
    </div>
  )
}
