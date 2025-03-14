'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

type User = {
  _id: string;
  name: string;
  email: string;
  department: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, department: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  getToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Load user from localStorage on initial render
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      setIsAuthenticated(true);
      
      // Set default auth header for axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { data, token } = response.data;
      
      // Save to state
      setUser(data);
      setToken(token);
      setIsAuthenticated(true);
      
      // Save to localStorage
      localStorage.setItem('user', JSON.stringify(data));
      localStorage.setItem('token', token);
      
      // Set default auth header for axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, department: string) => {
    setLoading(true);
    try {
      await axios.post('/api/auth/register', { name, email, password, department });
      // After registration, automatically log in
      await login(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Clear state
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Clear auth header
    delete axios.defaults.headers.common['Authorization'];
  };

  const getToken = async (): Promise<string> => {
    // Return token from state or localStorage
    if (token) return token;
    
    const storedToken = localStorage.getItem('token');
    if (storedToken) return storedToken;
    
    throw new Error('No authentication token found');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout, 
      isAuthenticated,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
