import { createContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    setIsAuthenticated(!!user);
  }, [user]);

  const login = async (username: string, password: string) => {
    await apiRequest("POST", "/api/auth/login", { username, password });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
  };

  const register = async (username: string, email: string, password: string) => {
    await apiRequest("POST", "/api/auth/register", { username, email, password });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout", {});
    queryClient.setQueryData(['/api/auth/me'], null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user: user || null,
        login,
        register,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Helper function to handle 401 responses differently
function getQueryFn<T>({ on401 }: { on401: "returnNull" | "throw" }) {
  return async ({ queryKey }: { queryKey: unknown[] }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (on401 === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }

      return await res.json();
    } catch (error) {
      if (on401 === "returnNull") return null;
      throw error;
    }
  };
}
