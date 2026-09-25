import React, { createContext, useContext, useState } from 'react';

// Safe default context to prevent "Cannot destructure property 'user' of 'useAuth(...)' as it is null"
const defaultAuthContext = {
  user: null,
  client: null,
  login: () => {},
  logout: () => {},
  isPlatform: false
};

const AuthContext = createContext(defaultAuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('renic_user')) || null;
    } catch {
      return null;
    }
  });

  const [client, setClient] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('renic_client')) || null;
    } catch {
      return null;
    }
  });

  const login = (userData, clientData) => {
    setUser(userData);
    setClient(clientData || null);
    localStorage.setItem('renic_user', JSON.stringify(userData));
    if (clientData) localStorage.setItem('renic_client', JSON.stringify(clientData));
    else localStorage.removeItem('renic_client');
  };

  const logout = () => {
    setUser(null);
    setClient(null);
    localStorage.removeItem('renic_token');
    localStorage.removeItem('renic_user');
    localStorage.removeItem('renic_client');
  };

  return (
    <AuthContext.Provider value={{ user, client, login, logout, isPlatform: user?.role === 'platform_owner' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  return ctx || defaultAuthContext;
};