import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, X, Bell, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';

const typeConfig: Record<string, { emoji: string; bg: string; label: string }> = {
  venue_change: { emoji: '📍', bg: 'bg-amber-50', label: 'Venue Change' },
  new_event:    { emoji: '📅', bg: 'bg-primary-50', label: 'New Event' },
  reminder:     { emoji: '🔔', bg: 'bg-emerald-50', label: 'Reminder' },
  announcement: { emoji: '📢', bg: 'bg-purple-50', label: 'Announcement' },
  cancellation: { emoji: '❌', bg: 'bg-red-50', label: 'Cancellation' },
};

export default function NotificationsPage() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '' });

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data.data),
  });

  const sendAnnouncement = useMutation({
    mutationFn: () => api.post('/notifications/announce', form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setShowModal(false);
      setForm({ subject: '', message: '' });
      toast.success(res.data.message || 'Announcement sent!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">All email alerts sent to your level</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex-shrink-0">
            <Send size={15} /> Send Announcement
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-slate-800">{notifications.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total sent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-emerald-600">{notifications.filter(n => n.deliveryStatus === 'sent').length}</p>
          <p className="text-xs text-slate-400 mt-1">Delivered</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-primary-600">{notifications.filter(n => n.isAutomatic).length}</p>
          <p className="text-xs text-slate-400 mt-1">Automated</p>
        </div>
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="card p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Bell size={24} className="text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700">No notifications yet</h3>
          <p className="text-sm text-slate-400 mt-1">Sent notifications will appear here.</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-50">
          {notifications.map(n => {
            const cfg = typeConfig[n.type] || typeConfig.announcement;
            return (
              <div key={n._id} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${cfg.bg}`}>
                  {cfg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 flex-1 text-sm">{n.subject}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {n.isAutomatic && (
                        <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">Auto</span>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                        n.deliveryStatus === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>{n.deliveryStatus}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {format(parseISO(n.createdAt), 'MMM d, yyyy · h:mm a')}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <CheckCircle size={10} /> {n.recipientCount} recipients
                    </span>
                    {n.sentBy && (
                      <span className="text-[11px] text-slate-400">by {n.sentBy.fullName}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Send Announcement</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Subject</label>
                <input className="input" placeholder="e.g. Important notice about upcoming exams"
                  value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input resize-none" rows={5} placeholder="Type your message here..."
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <p className="text-xs bg-primary-50 text-primary-700 px-3 py-2 rounded-lg">
                📧 This will be emailed to all students in your level and course of study.
              </p>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => sendAnnouncement.mutate()} disabled={!form.subject || !form.message || sendAnnouncement.isPending}>
                  {sendAnnouncement.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send to all students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
