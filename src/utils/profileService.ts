import api from './api';

export interface UpdateProfileData {
  fullName?: string;
  matricNumber?: string;
}

export interface UpdateEmailData {
  newEmail: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const profileService = {
  // Update profile (name & matric number)
  updateProfile: async (data: UpdateProfileData) =>
    api.put('/auth/profile', data),

  // Update email (requires password)
  updateEmail: async (data: UpdateEmailData) =>
    api.put('/auth/email', data),

  // Change password
  changePassword: async (data: ChangePasswordData) =>
    api.put('/auth/change-password', data),
};
