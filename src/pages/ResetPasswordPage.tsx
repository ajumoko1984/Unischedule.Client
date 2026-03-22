import { useState, FormEvent } from 'react';
import { useSearchParams, Link, useNavigate, useParams } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { resetPassword, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
//   const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { token } = useParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await resetPassword(token!, password);
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
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
            <div className="w-10 h-10 bg-primary-950 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-lg leading-tight">UniSchedule</div>
              <div className="text-xs text-slate-400">Set your new password</div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Reset Password</h1>
          <p className="text-sm text-slate-500 mb-7">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5">
              {isLoading ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : 'Reset Password'}
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