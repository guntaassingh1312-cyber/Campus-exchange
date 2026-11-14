import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, Package, QrCode, ScanLine, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { QrCodeCard } from '../components/qr/QrCodeCard';
import { QrScannerPanel } from '../components/qr/QrScannerPanel';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type Product, type TransactionItem } from '../lib/api';
import { formatDateTime } from '../lib/utils';

interface ScanLogItem {
  id: string;
  scanAction: string;
  status: string;
  details: string;
  createdAt: string;
}

interface QrCentreResponse {
  profileQrPayload: string;
  myProducts: Product[];
  activeTransactions: (TransactionItem & {
    activeToken: {
      rawCode: string;
      tokenType: string;
      expiresAt: string;
    } | null;
  })[];
  scanHistory: ScanLogItem[];
}

export function QrCentrePage({ isPublicScan = false }: { isPublicScan?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [centreData, setCentreData] = useState<QrCentreResponse | null>(null);
  const [loading, setLoading] = useState(!isPublicScan);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadCentre = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await apiFetch<QrCentreResponse>('/api/qr/centre');
      setCentreData(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load QR Centre.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !isPublicScan) {
      void loadCentre();
    }
  }, [user, isPublicScan, loadCentre]);

  const handleScanResult = async (rawValue: string) => {
    setScanFeedback(null);
    const trimmed = rawValue.trim();

    try {
      // If it looks like a handover token and user is signed in, verify handover directly
      if (trimmed.startsWith('PINGME:HANDOVER:')) {
        if (!user) {
          toast.error('Please sign in to verify a transaction handover QR.');
          navigate('/login');
          return;
        }
        const verified = await apiFetch<{
          verified: boolean;
          action: string;
          transaction: { transactionCode: string; transactionStatus: string };
        }>('/api/qr/transaction/verify', {
          method: 'POST',
          body: JSON.stringify({ rawCode: trimmed }),
        });

        const msg = `Handover verified! ${verified.transaction.transactionCode} is now ${verified.transaction.transactionStatus}.`;
        setScanFeedback({ type: 'success', message: msg });
        toast.success(msg);
        await loadCentre();
        return;
      }

      // Otherwise resolve discovery QR (Product or Profile)
      const resolved = await apiFetch<{
        type: 'product' | 'profile' | 'handover';
        product?: Product;
        profile?: { fullName: string; department: string; maskedStudentId: string; verificationStatus: string };
      }>(`/api/qr/resolve/${encodeURIComponent(trimmed)}`);

      if (resolved.type === 'product' && resolved.product) {
        toast.success(`Found ${resolved.product.title}`);
        navigate(
          user
            ? `/app/product/${resolved.product.productCode}`
            : `/p/${resolved.product.productCode}`
        );
        return;
      }

      if (resolved.type === 'profile' && resolved.profile) {
        const msg = `Verified PEC Student: ${resolved.profile.fullName} (${resolved.profile.maskedStudentId}) · ${resolved.profile.department}`;
        setScanFeedback({ type: 'success', message: msg });
        toast.success(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired QR code.';
      setScanFeedback({ type: 'error', message: msg });
      toast.error(msg);
      if (user && !isPublicScan) {
        void loadCentre();
      }
    }
  };

  const handleIssueTransactionQr = async (transactionId: string) => {
    try {
      await apiFetch(`/api/qr/transaction/${transactionId}/issue`, {
        method: 'POST',
      });
      toast.success('Generated 15-minute single-use handover QR token!');
      await loadCentre();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate handover QR.');
    }
  };

  if (isPublicScan) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <header className="border-b border-zinc-200 bg-white px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-zinc-900"
          >
            PingME
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/explore" className="text-zinc-600 hover:text-zinc-900">
              Marketplace
            </Link>
            {user ? (
              <Button asChild size="sm">
                <Link to="/app/qr-centre">Open QR Centre</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              PingME QR Discovery
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
              Scan any PingME Product or Student QR
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Test scanning a physical campus QR tag or enter a demo Product ID
              like <span className="font-mono text-zinc-900">PM-PEC-10242</span>.
            </p>
          </div>

          <QrScannerPanel onScanResult={handleScanResult} />

          {scanFeedback && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                scanFeedback.type === 'success'
                  ? 'border-teal-200 bg-teal-50 text-teal-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {scanFeedback.message}
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold text-zinc-700 mb-2">
              Quick Demo Product Codes to Test
            </p>
            <div className="flex flex-wrap gap-2">
              {['PM-PEC-10241', 'PM-PEC-10242', 'PM-PEC-10244', 'PM-PEC-10248'].map(
                (code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleScanResult(code)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-800 hover:border-teal-600 hover:text-teal-700 cursor-pointer"
                  >
                    {code}
                  </button>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          PingME QR Centre
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          Discover campus products via QR, issue cryptographic handover tokens,
          and audit scan activity.
        </p>
      </div>

      {scanFeedback && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            scanFeedback.type === 'success'
              ? 'border-teal-200 bg-teal-50 text-teal-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {scanFeedback.message}
        </div>
      )}

      <Tabs defaultValue="scan">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="scan" className="gap-1.5">
            <ScanLine className="h-3.5 w-3.5" />
            Scan QR
          </TabsTrigger>
          <TabsTrigger value="handover" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Active Transaction QRs
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            My Product QRs
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            My Profile QR
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Scan History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <QrScannerPanel onScanResult={handleScanResult} />
        </TabsContent>

        <TabsContent value="handover" className="space-y-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading active handovers...</p>
          ) : !centreData || centreData.activeTransactions.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
              <QrCode className="h-9 w-9 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-900">
                No active handover transactions
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Accepted or Booked purchases and rentals appear here for QR
                verification.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {centreData.activeTransactions.map((txn) => {
                const isSeller = txn.sellerId === user?.id;
                const canIssue =
                  (['Accepted', 'Booked'].includes(txn.transactionStatus) &&
                    isSeller) ||
                  ['Collected', 'Return Pending'].includes(
                    txn.transactionStatus
                  );

                return (
                  <div
                    key={txn.id}
                    className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-teal-700">
                          {txn.transactionCode}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                          Status: {txn.transactionStatus}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Role: {isSeller ? 'Owner / Seller' : 'Buyer / Renter'}
                        </p>
                      </div>
                      {canIssue && (
                        <Button
                          size="sm"
                          onClick={() => handleIssueTransactionQr(txn.id)}
                        >
                          {txn.activeToken
                            ? 'Regenerate QR'
                            : ['Collected', 'Return Pending'].includes(
                                  txn.transactionStatus
                                )
                              ? 'Generate Return QR'
                              : 'Generate Collection QR'}
                        </Button>
                      )}
                    </div>

                    {txn.activeToken ? (
                      <QrCodeCard
                        value={txn.activeToken.rawCode}
                        title={
                          txn.activeToken.tokenType === 'handover_collect'
                            ? 'One-Time Collection QR'
                            : 'One-Time Return QR'
                        }
                        subtitle={`Expires ${formatDateTime(txn.activeToken.expiresAt)}`}
                        codeLabel={txn.transactionCode}
                        size={160}
                        compact
                      />
                    ) : (
                      <p className="text-xs text-zinc-500 rounded-lg bg-zinc-50 p-3">
                        {isSeller
                          ? 'Click "Generate Collection QR" when meeting the student on campus.'
                          : 'Ask the counterparty to display their PingME handover QR, then scan it in the Scan QR tab.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading product QR labels...</p>
          ) : !centreData || centreData.myProducts.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-zinc-900">
                You haven’t listed any products yet
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/app/sell">Create Your First Listing</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {centreData.myProducts.map((prod) => (
                <QrCodeCard
                  key={prod.id}
                  value={prod.qrPayload}
                  title={prod.title}
                  subtitle={`${prod.availabilityStatus} · ${prod.pickupLocation}`}
                  codeLabel={prod.productCode}
                  size={168}
                  compact
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          {user && (
            <div className="max-w-sm">
              <QrCodeCard
                value={`PINGME:PROFILE:${user.studentId}`}
                title={user.fullName}
                subtitle={`${user.department} · ${user.verificationStatus === 'verified' ? 'Verified PEC Student' : 'Pending Verification'}`}
                codeLabel={user.maskedStudentId}
                size={210}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            {!centreData || centreData.scanHistory.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">
                No QR scans recorded for your account yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Outcome</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {centreData.scanHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono text-zinc-500 tabular-nums whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800 whitespace-nowrap">
                          {log.scanAction}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              log.status === 'success'
                                ? 'text-teal-700'
                                : 'text-red-600'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
