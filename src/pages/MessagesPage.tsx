import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type MessageItem, type PublicUser } from '../lib/api';
import { formatDateTime } from '../lib/utils';

export function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await apiFetch<{ messages: MessageItem[] }>('/api/messages');
      setMessages(res.messages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const threads = useMemo(() => {
    if (!user) return [];
    const map = new Map<
      string,
      { partner: PublicUser; lastMessage: MessageItem; messages: MessageItem[] }
    >();

    for (const msg of messages) {
      const isSender = msg.senderId === user.id;
      const partnerId = isSender ? msg.receiverId : msg.senderId;
      const partner = isSender ? msg.receiver : msg.sender;
      if (!partner) continue;

      const existing = map.get(partnerId);
      if (!existing) {
        map.set(partnerId, {
          partner,
          lastMessage: msg,
          messages: [msg],
        });
      } else {
        existing.messages.push(msg);
        existing.lastMessage = msg;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages, user]);

  useEffect(() => {
    if (!selectedPartnerId && threads.length > 0) {
      setSelectedPartnerId(threads[0].partner.id);
    }
  }, [threads, selectedPartnerId]);

  const activeThread = threads.find((t) => t.partner.id === selectedPartnerId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !draft.trim()) return;
    setSending(true);
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: selectedPartnerId,
          productId: activeThread?.lastMessage.productId || null,
          messageText: draft.trim(),
        }),
      });
      setDraft('');
      await loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Message failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          Campus Messages
        </h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          Coordinate pickup times, negotiate offers, and arrange QR handovers
          with PEC students.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading conversations...</p>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <MessageSquare className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-zinc-900">
            No conversations yet
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            Open any product page and click "Contact Seller" to start chatting.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/app/explore">Browse Listings</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-zinc-200 bg-white overflow-hidden min-h-[480px]">
          {/* Thread List */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-zinc-200 divide-y divide-zinc-100">
            {threads.map((t) => (
              <button
                key={t.partner.id}
                type="button"
                onClick={() => setSelectedPartnerId(t.partner.id)}
                className={`w-full text-left p-4 transition-colors cursor-pointer ${
                  selectedPartnerId === t.partner.id
                    ? 'bg-teal-50/70'
                    : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 truncate">
                    {t.partner.fullName}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                    {t.partner.maskedStudentId}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 truncate mt-1">
                  {t.lastMessage.messageText}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                  {formatDateTime(t.lastMessage.createdAt)}
                </p>
              </button>
            ))}
          </div>

          {/* Chat Pane */}
          <div className="lg:col-span-8 flex flex-col">
            {activeThread ? (
              <>
                <div className="border-b border-zinc-200 px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {activeThread.partner.fullName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {activeThread.partner.department}
                    </p>
                  </div>
                  {activeThread.lastMessage.product && (
                    <Link
                      to={`/app/product/${activeThread.lastMessage.product.productCode}`}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      {activeThread.lastMessage.product.title}
                    </Link>
                  )}
                </div>

                <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[360px] bg-[#FAFAFA]">
                  {activeThread.messages.map((msg) => {
                    const isMine = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMine ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                            isMine
                              ? 'bg-teal-600 text-white'
                              : 'bg-white border border-zinc-200 text-zinc-900'
                          }`}
                        >
                          {msg.messageText}
                        </div>
                        <span className="text-[10px] text-zinc-400 mt-1 tabular-nums">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleSend}
                  className="border-t border-zinc-200 p-3 flex gap-2 bg-white"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message about pickup or price..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sending || !draft.trim()}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-zinc-500">
                Select a conversation to view messages.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
