import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AuthenticatedUser } from '../types/auth';
import { authService } from '../services/authService';

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthority: boolean;
  isApplicant: boolean;
  displayName: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Requirement 4: ONLY check generic VYASA role 'authority'.
  // Do NOT check NIVARAN domain roles (MANAGER, DEAN, etc.).
  const isAuthority = useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => r.toLowerCase() === 'authority');
  }, [user]);

  // Check generic VYASA role 'applicant'.
  const isApplicant = useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => r.toLowerCase() === 'applicant');
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return '';
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    if (user.fullName) return user.fullName;
    return user.email;
  }, [user]);

  const refreshUser = useCallback(async () => {
    const currentToken = authService.getToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await authService.getCurrentUser();
      setUser(profile);
      setToken(currentToken);
    } catch {
      // Token invalid or expired: clear session
      authService.removeToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      setToken(res.access_token);
      // Immediately resolve user profile via GET /api/auth/me per Requirement 3
      const profile = await authService.getCurrentUser();
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      isAuthority,
      isApplicant,
      displayName,
      login,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, isAuthority, isApplicant, displayName, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
