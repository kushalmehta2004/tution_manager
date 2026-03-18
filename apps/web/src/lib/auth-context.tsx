'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { clearToken, loginTeacher } from './api';

export type User = {
  id: string;
  email: string;
  name: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = typeof window !== 'undefined' ? window.localStorage.getItem('tm_access_token') : null;
        
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Verify token is valid by calling /me endpoint
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const { user: userData } = (await response.json()) as { user: User };
          setUser(userData);
        } else {
          // Token is invalid, clear it
          clearToken();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await loginTeacher(email, password);
      
      // Fetch user info after login
      const meResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/me`,
        {
          headers: { Authorization: `Bearer ${response.accessToken}` },
        },
      );

      if (!meResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const { user: userData } = (await meResponse.json()) as { user: User };
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
