import { useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'

interface IsbnScannerProps {
  onDetected: (isbn: string) => void
  onClose: () => void
}

// Minimal typing for the native (experimental) BarcodeDetector API.
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

const isIsbnLike = (v: string) => /^\d{13}$/.test(v) || /^\d{8}$/.test(v)

/**
 * Camera-based ISBN scanner (EAN-13 = ISBN-13). Uses the native BarcodeDetector
 * API when available (e.g. Android Chrome); otherwise falls back to a pure-JS
 * ZXing decoder so scanning also works on iOS (Safari/Chrome/WeChat all use
 * WebKit, which has no BarcodeDetector). Manual ISBN entry remains the final
 * fallback on the Scan / Add pages.
 */
export function IsbnScanner({ onDetected, onClose }: IsbnScannerProps) {
  const { t } = useLingui()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    function finish(value: string) {
      if (cancelled) return
      onDetected(value)
    }

    async function startNative() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8'] })
      const tick = async () => {
        if (cancelled || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          const hit = codes.find((c) => isIsbnLike(c.rawValue))
          if (hit) return finish(hit.rawValue)
        } catch {
          // keep scanning
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    async function startZxing() {
      // Dynamic import: keeps ZXing (~a few hundred KB) out of the main bundle;
      // only loaded when a scan actually starts without native support.
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8])
      const reader = new BrowserMultiFormatReader(hints)
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (cancelled || !result) return
          const text = result.getText()
          if (isIsbnLike(text)) {
            controls.stop()
            finish(text)
          }
        },
      )
      zxingControlsRef.current = controls
    }

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError(t`Camera is not available. Enter the ISBN manually.`)
        return
      }
      try {
        if (typeof window !== 'undefined' && window.BarcodeDetector) {
          await startNative()
        } else {
          await startZxing() // iOS / browsers without BarcodeDetector
        }
      } catch (e) {
        const name = (e as { name?: string } | null)?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError(t`Camera permission denied. Allow camera access or enter the ISBN manually.`)
        } else if (name === 'NotFoundError') {
          setError(t`No camera found. Enter the ISBN manually.`)
        } else {
          setError(t`Could not start the scanner. Enter the ISBN manually.`)
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      zxingControlsRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected, t])

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
          <Trans>Cancel scan</Trans>
        </Button>
      </div>
    </div>
  )
}
