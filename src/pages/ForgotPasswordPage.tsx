import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const { forgotPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword(email);
      toast.success('Password reset link sent! Check your email.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reset link');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px] animate-fade-in">
        <div className="bg-white rounded-2xl shadow-modal p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-lg leading-tight">UniSchedule</div>
              <div className="text-xs text-slate-400">Reset your password</div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Forgot Password</h1>
          <p className="text-sm text-slate-500 mb-7">
            Enter your email address and we'll send you a password reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@unilorin.edu.ng"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-slate-500">
            Remembered your password?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">University of Ilorin · Student Account</p>
      </div>
    </div>
  );
}