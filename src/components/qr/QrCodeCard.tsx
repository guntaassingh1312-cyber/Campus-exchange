import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Printer, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';

interface QrCodeCardProps {
  value: string;
  title: string;
  subtitle?: string;
  codeLabel?: string;
  size?: number;
  compact?: boolean;
}

export function QrCodeCard({
  value,
  title,
  subtitle,
  codeLabel,
  size = 200,
  compact = false,
}: QrCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#18181b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${(codeLabel || title).replace(/[^a-zA-Z0-9_-]/g, '_')}-PingME-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code PNG downloaded.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('QR code token copied to clipboard.');
    } catch {
      toast.error('Unable to copy QR token.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-900 truncate">{title}</h4>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {codeLabel && (
          <span className="font-mono text-xs font-medium text-teal-700 shrink-0 tabular-nums">
            {codeLabel}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 p-4">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`PingME QR code for ${title}`}
            style={{ width: compact ? 136 : size, height: compact ? 136 : size }}
            className="rounded-md bg-white p-1.5 border border-zinc-200"
          />
        ) : (
          <div
            style={{ width: compact ? 136 : size, height: compact ? 136 : size }}
            className="flex items-center justify-center rounded-md bg-zinc-100 text-zinc-400"
          >
            <QrCode className="h-8 w-8" />
          </div>
        )}
        <p className="mt-2.5 font-mono text-[11px] text-zinc-500 break-all text-center max-w-full">
          {value}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="flex-1"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex-1"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Token
        </Button>
        {!compact && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        )}
      </div>
    </div>
  );
}
