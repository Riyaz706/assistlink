import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, setAccessToken } from "../api/client";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";

type User = any;

type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const TOKEN_KEY = "assistlink_token";

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (token) {
        console.log("Token retrieved from localStorage on refresh");
      }
      return token;
    } catch (e) {
      console.warn("Failed to get token from localStorage:", e);
      return null;
    }
  }
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      console.log("Token retrieved from SecureStore on refresh");
    }
    return token;
  } catch (e) {
    console.warn("Failed to get token from SecureStore:", e);
    return null;
  }
}

async function setToken(value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(TOKEN_KEY, value);
      console.log("Token saved to localStorage");
    } catch {
      // ignore storage errors on web
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
    console.log("Token saved to SecureStore");
  } catch (e) {
    console.warn("Failed to save token to SecureStore:", e);
  }
}

async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      console.log("Token cleared from localStorage");
    } catch (e) {
      console.warn("Failed to clear token from localStorage:", e);
      // ignore - continue with logout
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    console.log("Token cleared from SecureStore");
  } catch (e) {
    console.warn("Failed to clear token from SecureStore:", e);
    // ignore - continue with logout even if clearing fails
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      console.log("AuthContext: Restoring authentication state...");
      try {
        const token = await getToken();
        if (token) {
          console.log("AuthContext: Token found, validating with backend...");
          setAccessTokenState(token);
          setAccessToken(token);
          try {
            const me = await api.me();
            if (isMounted) {
              console.log("AuthContext: User profile restored:", (me as any)?.email || (me as any)?.full_name || "Unknown");
              setUser(me as any);

              // Tag user in Sentry
              Sentry.setUser({
                id: (me as any).id,
                email: (me as any).email,
                username: (me as any).full_name,
              });
            }
          } catch (meError: any) {
            // If token is invalid (401), clear it
            const errorMsg = meError?.message || '';
            console.error("AuthContext: Failed to fetch user profile:", errorMsg);
            if (isMounted) {
              if (errorMsg.includes('401') || errorMsg.includes('Not authenticated') || errorMsg.includes('Unauthorized')) {
                console.log("AuthContext: Token expired or invalid - clearing...");
                await clearToken();
                setAccessTokenState(null);
                setAccessToken(null);
                setUser(null);
              } else {
                // For other errors (network, etc.), keep the token but log the error
                console.warn("AuthContext: Failed to fetch user profile, but keeping token (might be network issue):", meError);
                // Don't set user, but don't clear token either - might be a temporary network issue
              }
            }
          }
        } else {
          console.log("AuthContext: No token found, user not logged in");
        }
      } catch (e) {
        console.error("AuthContext: Failed to restore auth:", e);
        if (isMounted) {
          // Clear any potentially corrupted token
          await clearToken();
          setAccessTokenState(null);
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          console.log("AuthContext: Auth restoration complete, loading set to false");
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log("AuthContext: Starting login...");
    try {
      const res = await api.login({ email, password });
      const token = res.access_token;
      console.log("AuthContext: Login successful, token received");

      await setToken(token);
      setAccessTokenState(token);
      setAccessToken(token);

      try {
        const me = await api.me();
        console.log("AuthContext: User profile fetched:", (me as any)?.email || (me as any)?.full_name || "Unknown");
        setUser(me as any);

        // Tag user in Sentry
        Sentry.setUser({
          id: (me as any).id || res.user?.id,
          email: (me as any).email || email,
          username: (me as any).full_name,
        });
      } catch (meError: any) {
        console.error("AuthContext: Failed to fetch user profile after login:", meError);
        // Even if fetching profile fails, we have the token, so set a minimal user object
        // The user can still use the app, and we'll retry on next load
        setUser({ email, id: res.user?.id || null });
        throw new Error("Login successful but failed to load profile. Please try again.");
      }
    } catch (error: any) {
      console.error("AuthContext: Login error:", error);
      // Clear any partial state
      await clearToken();
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const token = await getToken();
      if (token) {
        setAccessTokenState(token);
        setAccessToken(token);
        const me = await api.me();
        setUser(me as any);
      }
    } catch (error) {
      console.error("AuthContext: Error refreshing user:", error);
    }
  };

  const logout = async () => {
    try {
      console.log("AuthContext: Logging out...");

      // Clear state first to trigger immediate navigation
      // This ensures the UI responds immediately
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);

      // Clear user in Sentry
      Sentry.setUser(null);

      // Then clear token in background (non-blocking)
      clearToken().catch((error) => {
        console.warn("AuthContext: Error clearing token (non-critical):", error);
      });

      console.log("AuthContext: Logout complete - state cleared");
    } catch (error) {
      console.error("AuthContext: Error during logout:", error);
      // Force state clear even if there's an error
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);

      // Clear user in Sentry
      Sentry.setUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    console.log("AuthContext: Requesting password reset for:", email);
    try {
      await api.resetPassword({ email });
      console.log("AuthContext: Password reset email sent successfully");
    } catch (error: any) {
      console.error("AuthContext: Password reset error:", error);
      throw error;
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    console.log("AuthContext: Updating password...");
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      console.log("AuthContext: Password updated successfully");
    } catch (error: any) {
      console.error("AuthContext: Update password error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: accessTokenState,
        loading,
        login,
        logout,
        refreshUser,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};


