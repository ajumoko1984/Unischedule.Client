import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Message } from '../types';

interface MessageThread extends Message {
  replies: Message[];
}

type RecipientTarget = 'super_admin' | 'level_adviser';

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [recipientTarget, setRecipientTarget] = useState<RecipientTarget>('super_admin');
  const [form, setForm] = useState({ message: '', recipientRole: 'super_admin' as RecipientTarget });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages'],
    queryFn: () => api.get('/messages').then(r => r.data.data),
  });

  const messageThreads = useMemo(() => {
    const map = new Map<string, MessageThread>();

    messages.forEach((msg) => {
      map.set(msg._id, { ...msg, replies: [] });
    });

    const roots: MessageThread[] = [];

    map.forEach((msg) => {
      if (msg.replyTo && typeof msg.replyTo === 'string' && map.has(msg.replyTo)) {
        map.get(msg.replyTo)?.replies.push(msg);
      } else {
        roots.push(msg);
      }
    });

    return roots.sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
  }, [messages]);

  const activeThread = useMemo(() => {
    if (isCreatingNew) return null;
    if (activeThreadId) {
      return messageThreads.find((thread) => thread._id === activeThreadId) ?? null;
    }
    return messageThreads[0] ?? null;
  }, [messageThreads, activeThreadId, isCreatingNew]);

  const sendMessage = useMutation({
    mutationFn: () => api.post('/messages', form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      setForm({ message: '', recipientRole: recipientTarget });
      setIsCreatingNew(false);
      toast.success(
        res.data.message || `Message sent to ${recipientTarget === 'level_adviser' ? 'Level Adviser' : 'Super Admin'}`
      );
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send message'),
  });

  const replyMessage = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => api.post(`/messages/${id}/reply`, { message }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      setForm({ message: '' });
      toast.success(res.data.message || 'Reply sent');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send reply'),
  });

  const isSendPending = activeThread && !isCreatingNew ? replyMessage.isPending : sendMessage.isPending;

  const handleSend = () => {
    const message = form.message.trim();
    if (!message) {
      toast.error('Enter a message before sending.');
      return;
    }

    if (activeThread && !isCreatingNew) {
      replyMessage.mutate({ id: activeThread._id, message });
      return;
    }

    sendMessage.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const hasThreads = messageThreads.length > 0;
  const isSuperAdmin = user?.role === 'super_admin';
  const activeThreadMessages = activeThread
    ? [activeThread, ...activeThread.replies.sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime())]
    : [];

  const recipientNames = activeThread?.recipients?.map((r) => r.fullName) ?? [];
  const recipientLabel = activeThread
    ? recipientNames.length > 0
      ? recipientNames.join(', ')
      : 'Super Admin'
    : recipientTarget === 'level_adviser'
      ? 'Level Adviser'
      : 'Super Admin';

  const recipientOptions: Array<{ value: RecipientTarget; label: string }> = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'level_adviser', label: 'Level Adviser' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="text-sm text-slate-500 mt-1">
            Use the chat below to send a message to Super Admin or your Level Adviser.
          </p>
        </div>
        {!isSuperAdmin && (
          <button
            className="btn-secondary"
            onClick={() => { setIsCreatingNew(true); setActiveThreadId(null); }}
          >
            Start New Conversation
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {hasThreads && (
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Conversations</p>
                <p className="text-xs text-slate-500">Select a thread to view the full chat.</p>
              </div>
              <span className="text-xs text-slate-400">{messageThreads.length}</span>
            </div>

            <div className="space-y-2">
              {messageThreads.map((thread) => (
                <button
                  key={thread._id}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${
                    activeThread?._id === thread._id && !isCreatingNew
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => { setActiveThreadId(thread._id); setIsCreatingNew(false); }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{thread.subject || 'Message to Super Admin'}</span>
                    <span className="text-[11px] text-slate-400">{format(parseISO(thread.createdAt), 'MMM d')}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-2">{thread.message}</p>
                  {thread.replies.length > 0 && (
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                      {thread.replies.length} {thread.replies.length > 1 ? 'replies' : 'reply'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 h-full">
          <div className="card flex-1 p-5 flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{isCreatingNew ? 'New Conversation' : activeThread ? 'Conversation' : 'Messages'}</h2>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-500">
                    {isCreatingNew
                      ? 'New messages will be added to your history once sent.'
                      : activeThread
                        ? 'All previous messages are shown below in chronological order.'
                        : 'Start a conversation to contact Super Admin.'}
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    <span className="font-medium">To:</span>
                    <span>{recipientLabel}</span>
                  </div>
                </div>
              </div>
              {!isSuperAdmin && hasThreads && !isCreatingNew && (
                <button className="btn-secondary" onClick={() => { setIsCreatingNew(true); setActiveThreadId(null); }}>
                  New Conversation
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {isCreatingNew ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                  Start typing your new message below. Previous messages will remain in your conversation history.
                </div>
              ) : activeThread ? (
                activeThreadMessages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`rounded-3xl p-4 max-w-[90%] ${
                      msg.sender._id === user?._id ? 'ml-auto bg-primary-50 text-slate-900' : 'mr-auto bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2 text-[11px] text-slate-500">
                      <span>{msg.sender.fullName}</span>
                      <span>{format(parseISO(msg.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-500">
                  No conversation selected. Use the sidebar to choose a thread, or start a new message below.
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className="label">Message</label>
              <textarea
                className="input resize-none h-32"
                placeholder={activeThread && !isCreatingNew ? 'Type your reply here...' : 'Type your message here...'}
                value={form.message}
                onChange={e => setForm({ message: e.target.value })}
              />
              <div className="flex items-center justify-between gap-2 mt-3">
                <span className="text-xs text-slate-400">Messages stay in the same thread and appear below older messages.</span>
                <button
                  className="btn-primary"
                  disabled={!form.message.trim() || isSendPending || (isSuperAdmin && !activeThread)}
                  onClick={handleSend}
                >
                  {isSendPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span className="ml-2">Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
