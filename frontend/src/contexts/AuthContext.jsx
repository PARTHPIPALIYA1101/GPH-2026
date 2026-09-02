import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gov_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('gov_auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiRequest('/auth/me');
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('gov_auth_user', JSON.stringify(res.data));
        }
      } catch (err) {
        console.error('Failed to verify existing session:', err.message);
        localStorage.removeItem('gov_auth_token');
        localStorage.removeItem('gov_auth_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  async function login(email, password) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (res.success && res.data) {
      localStorage.setItem('gov_auth_token', res.data.token);
      localStorage.setItem('gov_auth_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error(res.message || 'Login failed.');
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('gov_auth_token');
      localStorage.removeItem('gov_auth_user');
      setUser(null);
    }
  }

  const isStateAdmin = user?.roles?.includes('STATE_ADMIN') ?? false;
  const isDeptHead = user?.roles?.includes('DEPARTMENT_HEAD') ?? false;
  const isOfficer = user?.roles?.includes('OFFICER') ?? false;
  const isOperator = user?.roles?.includes('OPERATOR') ?? false;
  const isInvestigator = user?.roles?.includes('INVESTIGATOR') ?? false;

  const value = {
    user,
    loading,
    login,
    logout,
    isStateAdmin,
    isDeptHead,
    isOfficer,
    isOperator,
    isInvestigator
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
