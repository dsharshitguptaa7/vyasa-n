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
  isAdmin: boolean;
  isAuthority: boolean;
  isApplicant: boolean;
  isManager: boolean;
  isAssistantDean: boolean;
  isAssociateDean: boolean;
  isDean: boolean;
  authorityRole: string | null;
  authorityId: string | null;
  authorityDesignation: string | null;
  persona: 'applicant' | 'admin' | 'manager' | 'assistant_dean' | 'associate_dean' | 'dean' | 'authority' | 'guest';
  displayName: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(authService.getToken()));

  const isAdmin = useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => ['administrator', 'admin'].includes(r.toLowerCase()));
  }, [user]);

  // Requirement 4: ONLY check generic VYASA role 'authority'.
  const isAuthority = useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => r.toLowerCase() === 'authority');
  }, [user]);

  // Check generic VYASA role 'applicant'.
  const isApplicant = useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => r.toLowerCase() === 'applicant');
  }, [user]);

  const authorityRole = useMemo(() => {
    if (!user) return null;
    if (user.authority_role) return user.authority_role.toUpperCase();
    if (user.roles) {
      if (user.roles.some((r) => r.toLowerCase() === 'manager')) return 'MANAGER';
      if (user.roles.some((r) => r.toLowerCase() === 'assistant_dean')) return 'ASSISTANT_DEAN';
      if (user.roles.some((r) => r.toLowerCase() === 'associate_dean')) return 'ASSOCIATE_DEAN';
      if (user.roles.some((r) => r.toLowerCase() === 'dean')) return 'DEAN';
    }
    return null;
  }, [user]);

  const authorityId = useMemo(() => user?.authority_id || null, [user]);
  const authorityDesignation = useMemo(() => user?.authority_designation || null, [user]);

  const isManager = useMemo(() => authorityRole === 'MANAGER', [authorityRole]);
  const isAssistantDean = useMemo(() => authorityRole === 'ASSISTANT_DEAN', [authorityRole]);
  const isAssociateDean = useMemo(() => authorityRole === 'ASSOCIATE_DEAN', [authorityRole]);
  const isDean = useMemo(() => authorityRole === 'DEAN', [authorityRole]);

  const persona = useMemo<AuthContextValue['persona']>(() => {
    if (!user) return 'guest';
    if (authorityRole === 'MANAGER') return 'manager';
    if (authorityRole === 'ASSISTANT_DEAN') return 'assistant_dean';
    if (authorityRole === 'ASSOCIATE_DEAN') return 'associate_dean';
    if (authorityRole === 'DEAN') return 'dean';
    if (isAdmin && !authorityRole) return 'admin';
    if (isApplicant && !isAuthority && !isAdmin) return 'applicant';
    if (isAdmin) return 'admin';
    if (isApplicant) return 'applicant';
    if (isAuthority) return 'authority';
    return 'guest';
  }, [user, authorityRole, isAdmin, isApplicant, isAuthority]);

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
    let isMounted = true;
    const currentToken = authService.getToken();
    if (!currentToken) {
      return;
    }

    authService
      .getCurrentUser()
      .then((profile) => {
        if (isMounted) {
          setUser(profile);
          setToken(currentToken);
        }
      })
      .catch(() => {
        if (isMounted) {
          authService.removeToken();
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
      isAdmin,
      isAuthority,
      isApplicant,
      isManager,
      isAssistantDean,
      isAssociateDean,
      isDean,
      authorityRole,
      authorityId,
      authorityDesignation,
      persona,
      displayName,
      login,
      logout,
      refreshUser,
    }),
    [
      user,
      token,
      isLoading,
      isAdmin,
      isAuthority,
      isApplicant,
      isManager,
      isAssistantDean,
      isAssociateDean,
      isDean,
      authorityRole,
      authorityId,
      authorityDesignation,
      persona,
      displayName,
      refreshUser,
    ]
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
