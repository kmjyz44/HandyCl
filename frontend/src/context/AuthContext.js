import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/apiClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getMe();
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('session_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.login({ email, password });
    const { user, session_token } = response.data;
    localStorage.setItem('session_token', session_token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const register = async (data) => {
    const response = await api.register(data);
    const { user, session_token } = response.data;
    localStorage.setItem('session_token', session_token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('session_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
