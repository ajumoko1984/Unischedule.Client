import { useState, FormEvent } from 'react';
import { User, Mail, Lock, Save, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../utils/profileService';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'email' | 'password';

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    matricNumber: user?.matricNumber || '',
  });

  // Email form
  const [emailForm, setEmailForm] = useState({
    newEmail: user?.email || '',
    password: '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Update Profile
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setIsLoading(true);
    try {
      const res = await profileService.updateProfile(profileForm);
      toast.success('Profile updated successfully!');
      // Could refresh user data from context here if needed
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Update Email
  const handleUpdateEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailForm.newEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!emailForm.password.trim()) {
      toast.error('Password is required to confirm email change');
      return;
    }
    if (emailForm.newEmail === user?.email) {
      toast.error('New email must be different from current email');
      return;
    }

    setIsLoading(true);
    try {
      const res = await profileService.updateEmail(emailForm);
      toast.success('Email updated successfully!');
      setEmailForm({ ...emailForm, password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update email');
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword.trim()) {
      toast.error('Current password is required');
      return;
    }
    if (!passwordForm.newPassword.trim()) {
      toast.error('New password is required');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setIsLoading(true);
    try {
      await profileService.changePassword(passwordForm);
      toast.success('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Edit Profile</h1>
          <p className="text-slate-600 mt-1">Manage your account settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 sticky top-4">
            {[
              { id: 'profile', label: 'Profile Info', icon: User },
              { id: 'email', label: 'Email Address', icon: Mail },
              { id: 'password', label: 'Password', icon: Lock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as TabType)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                  activeTab === id
                    ? 'bg-primary-100 text-primary-700 border border-primary-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">Profile Information</h2>
                  <p className="text-slate-600">Update your personal details</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="label">Full Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Your full name"
                      value={profileForm.fullName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, fullName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Email (Read-only)</label>
                    <input
                      type="email"
                      className="input bg-slate-50"
                      value={user?.email || ''}
                      disabled
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Use the Email tab to change your email address
                    </p>
                  </div>

                  <div>
                    <label className="label">Matric Number</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. 20/52HA001"
                      value={profileForm.matricNumber}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          matricNumber: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary gap-2 justify-center"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">Change Email</h2>
                  <p className="text-slate-600">Update your email address</p>
                </div>

                <form onSubmit={handleUpdateEmail} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-900">
                      💡 For security, you'll need to confirm your current password to change your email.
                    </p>
                  </div>

                  <div>
                    <label className="label">Current Email</label>
                    <input
                      type="email"
                      className="input bg-slate-50"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>

                  <div>
                    <label className="label">New Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="your.newemail@gmail.com"
                      value={emailForm.newEmail}
                      onChange={(e) =>
                        setEmailForm({ ...emailForm, newEmail: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        className="input pr-10"
                        placeholder="Confirm with your password"
                        value={emailForm.password}
                        onChange={(e) =>
                          setEmailForm({ ...emailForm, password: e.target.value })
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            current: !showPasswords.current,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.current ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary gap-2 justify-center"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          Update Email
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">Change Password</h2>
                  <p className="text-slate-600">Update your password for security</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-900">
                      🔒 Keep your password strong and unique. Never share it with anyone.
                    </p>
                  </div>

                  <div>
                    <label className="label">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        className="input pr-10"
                        placeholder="Your current password"
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            currentPassword: e.target.value,
                          })
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            current: !showPasswords.current,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.current ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        className="input pr-10"
                        placeholder="New password (min. 6 characters)"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            newPassword: e.target.value,
                          })
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            new: !showPasswords.new,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.new ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        className="input pr-10"
                        placeholder="Confirm your new password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            confirm: !showPasswords.confirm,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary gap-2 justify-center"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <Lock size={16} />
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
