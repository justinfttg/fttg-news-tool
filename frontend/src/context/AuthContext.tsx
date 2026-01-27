import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { getStoredUser, getStoredToken, logout as logoutService } from '../services/auth.service';

interface AuthContextType extends AuthState {
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const user = getStoredUser();
    const token = getStoredToken();
    setState({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading: false,
    });
  }, []);

  const setAuth = (user: User, token: string) => {
    setState({ user, token, isAuthenticated: true, isLoading: false });
  };

  const logout = () => {
    logoutService();
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
