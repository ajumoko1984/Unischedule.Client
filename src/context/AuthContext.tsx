import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isClassRep: boolean;
  isLevelAdviser: boolean;
  canManage: boolean;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  role?: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  matricNumber?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token && !user) {
      api.get('/auth/me').then(res => {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }).catch(() => logout());
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', data);
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const forgotPassword = async (email: string) => {
  setIsLoading(true);
  try {
    await api.post('/auth/forgot-password', { email });
  } finally {
    setIsLoading(false);
  }
};

const resetPassword = async (token: string, newPassword: string) => {
  setIsLoading(true);
  try {
    await api.post(`/auth/reset-password/${token}`, { password: newPassword });
  } finally {
    setIsLoading(false);
  }
};

  const isAdmin = user?.role === 'super_admin';
  const isClassRep = user?.role === 'class_rep';
  const isLevelAdviser = user?.role === 'level_adviser';
  const canManage = isAdmin || isClassRep || isLevelAdviser;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, isAdmin, isClassRep, isLevelAdviser, canManage,   forgotPassword,
  resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};