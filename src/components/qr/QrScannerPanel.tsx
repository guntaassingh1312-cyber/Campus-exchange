import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface QrScannerPanelProps {
  onScanResult: (rawValue: string) => Promise<void> | void;
  placeholder?: string;
  submitLabel?: string;
  helperText?: string;
}

export function QrScannerPanel({
  onScanResult,
  placeholder = 'Enter Product ID (e.g. PM-PEC-10242) or handover QR token',
  submitLabel = 'Validate & Open',
  helperText = 'Point your camera at any PingME product label or handover QR, or enter the code manually.',
}: QrScannerPanelProps) {
  const rawId = useId();
  const scannerElementId = `pingme-qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const instance = new Html5Qrcode(scannerElementId);
      scannerRef.current = instance;
      setCameraActive(true);

      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          setLastScanned(decodedText);
          await stopCamera();
          await handleDispatch(decodedText);
        },
        () => {
          // Per-frame decode misses are normal
        }
      );
    } catch (err) {
      setCameraActive(false);
      scannerRef.current = null;
      const msg =
        err instanceof Error ? err.message : 'Camera permission denied or unavailable.';
      setCameraError(
        `Camera unavailable (${msg}). You can enter the Product ID or QR token manually below.`
      );
    }
  };

  const handleDispatch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onScanResult(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await handleDispatch(manualInput);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            Scan PingME QR Code
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{helperText}</p>
        </div>
        {!cameraActive ? (
          <Button type="button" onClick={startCamera} size="sm">
            <Camera className="h-4 w-4" />
            Start Camera Scan
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={stopCamera}
            size="sm"
          >
            <CameraOff className="h-4 w-4" />
            Stop Camera
          </Button>
        )}
      </div>

      <div
        className={`relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 ${
          cameraActive ? 'min-h-[260px]' : 'min-h-[160px] bg-zinc-50'
        } flex items-center justify-center`}
      >
        <div id={scannerElementId} className="w-full max-w-sm" />
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Camera className="h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-sm font-medium text-zinc-700">
              Camera scanner standby
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Click "Start Camera Scan" to detect a PingME QR code live, or enter a Product ID below.
            </p>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}

      {lastScanned && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2.5 text-xs text-teal-900">
          <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="font-mono truncate">Detected: {lastScanned}</span>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={placeholder}
            className="pl-9 font-mono text-xs"
            aria-label="Manual Product ID or QR token"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={submitting || !manualInput.trim()}>
          {submitting ? 'Validating...' : submitLabel}
        </Button>
      </form>
    </div>
  );
}
