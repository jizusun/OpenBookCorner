import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

interface IsbnScannerProps {
  onDetected: (isbn: string) => void
  onClose: () => void
}

// Minimal typing for the experimental BarcodeDetector API.
interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): BarcodeDetectorLike
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

/**
 * Camera-based ISBN scanner using the BarcodeDetector API (EAN-13 = ISBN-13).
 * Shows a clear message + manual-entry fallback when the API or camera is unavailable.
 */
export function IsbnScanner({ onDetected, onClose }: IsbnScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof window === 'undefined' || !window.BarcodeDetector) {
        setError('Barcode scanning is not supported on this device/browser. Enter the ISBN manually.')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not available. Enter the ISBN manually.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8'] })

        const tick = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const hit = codes.find((c) => /^\d{13}$/.test(c.rawValue) || /^\d{8}$/.test(c.rawValue))
            if (hit) {
              onDetected(hit.rawValue)
              return
            }
          } catch {
            // keep scanning
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        setError('Could not access the camera. Check permissions or enter the ISBN manually.')
      }
    }

    void start()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="space-y-3 rounded-md border p-3">
      {error ? (
        <p className="text-sm text-destructive" data-testid="scan-error">
          {error}
        </p>
      ) : (
        <video ref={videoRef} className="w-full rounded-md bg-black" muted playsInline />
      )}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel scan
        </Button>
      </div>
    </div>
  )
}
