import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, apiConfigReady, setAccessToken, setRefreshToken } from "../api/client";
import { Platform } from "react-native";

type User = any;

type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string, role?: "care_recipient" | "caregiver") => Promise<void>;
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
        await apiConfigReady; // use saved Backend URL override if set (so IP change works without rebuild)
        const token = await getToken();
        if (token) {
          console.log("AuthContext: Token found, validating with backend...");
          setAccessTokenState(token);
          setAccessToken(token);
          const isTimeoutOrNetwork = (e: any) =>
            e?.code === 'TIMEOUT' || e?.statusCode === 408 ||
            (e?.message && /timeout|network|connection|fetch/i.test(e.message || ''));
          let meError: any = null;
          for (let attempt = 1; attempt <= 2 && isMounted; attempt++) {
            try {
              const me = await api.me();
              if (isMounted) {
                console.log("AuthContext: User profile restored:", (me as any)?.email || (me as any)?.full_name || "Unknown");
                setUser(me as any);
              }
              meError = null;
              break;
            } catch (err: any) {
              meError = err;
              const errorMsg = meError?.message || '';
              console.error("AuthContext: Failed to fetch user profile:", errorMsg);
              if (isMounted) {
                if (meError.statusCode === 401 || errorMsg.includes('401') || errorMsg.includes('Not authenticated') || errorMsg.includes('Unauthorized')) {
                  console.log("AuthContext: Token expired or invalid - clearing...");
                  await clearToken();
                  setAccessTokenState(null);
                  setAccessToken(null);
                  setUser(null);
                  break;
                }
                if (attempt === 1 && isTimeoutOrNetwork(meError)) {
                  console.log("AuthContext: Retrying /api/auth/me in 2s...");
                  await new Promise((r) => setTimeout(r, 2000));
                  continue;
                }
                console.warn("AuthContext: Failed to fetch user profile (keeping token):", meError?.message || meError);
                if (isMounted && isTimeoutOrNetwork(meError)) {
                  setUser({ _needsRefresh: true, role: "care_recipient" } as any);
                }
                break;
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
    await apiConfigReady;
    const isTimeoutOrNetwork = (e: any) =>
      e?.code === "TIMEOUT" || e?.statusCode === 408 ||
      (e?.message && /timeout|network|connection|fetch/i.test(e?.message || ""));
    let lastError: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await api.login({ email, password });
        lastError = null;
        const token = res?.access_token;
        const refreshToken = res?.refresh_token;
        if (!token) {
          throw new Error("Login failed: No token received from server. Please try again.");
        }
        console.log("AuthContext: Login successful, token received");

        await setToken(token);
        setAccessTokenState(token);
        setAccessToken(token);

        const readBack = await getToken();
        if (readBack !== token) {
          console.warn("AuthContext: Token read-back failed - session may not persist after app restart.");
          throw new Error("Could not save login. Please try again or check app storage permissions.");
        }

        if (refreshToken) {
          await setRefreshToken(refreshToken);
        }

        try {
          const me = await api.me();
          console.log("AuthContext: User profile fetched:", (me as any)?.email || (me as any)?.full_name || "Unknown");
          setUser(me as any);
        } catch (meError: any) {
          console.warn("AuthContext: Failed to fetch /me after login, using login response user:", meError);
          if (res.user && typeof res.user === "object") {
            setUser(res.user as any);
          } else {
            setUser({ email, id: res.user?.id || null, role: (res.user as any)?.role || "care_recipient" });
          }
        }
        return;
    } catch (error: any) {
      lastError = error;
      if (attempt === 1 && isTimeoutOrNetwork(error)) {
        console.log("AuthContext: Login timeout/network error, retrying in 2s...");
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
    }
    const error = lastError;
    console.error("AuthContext: Login error:", error);
    await clearToken();
    setAccessTokenState(null);
    setAccessToken(null);
    await setRefreshToken(null);
    setUser(null);
    throw error;
  };

  const googleLogin = async (idToken: string, role: "care_recipient" | "caregiver" = "care_recipient") => {
    console.log("AuthContext: Starting Google login...");
    try {
      // Role defaults to care_recipient for now, can be adjusted or passed in
      const res = await api.googleAuth({
        id_token: idToken,
        role: role
      });

      const token = res.access_token;
      const refreshToken = res.refresh_token;
      console.log("AuthContext: Google Login successful");

      await setToken(token);
      // Update client.ts persistence
      if (Platform.OS === 'web') {
        window.localStorage.setItem('assistlink_token', token);
      } else {
        await SecureStore.setItemAsync('assistlink_token', token);
      }

      setAccessTokenState(token);
      setAccessToken(token);

      if (refreshToken) {
        await setRefreshToken(refreshToken);
      }

      try {
        const me = await api.me();
        setUser(me as any);
      } catch (meError) {
        console.error("AuthContext: Failed to fetch profile after Google login", meError);
        setUser(res.user);
      }
    } catch (error: any) {
      console.error("AuthContext: Google Login error:", error);
      await clearToken();
      setAccessTokenState(null);
      setAccessToken(null);
      await setRefreshToken(null);
      setUser(null);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      setAccessTokenState(token);
      setAccessToken(token);
      const me = await api.me();
      setUser(me as any);
    } catch (error: any) {
      if (error?.statusCode === 401) {
        await clearToken();
        setAccessTokenState(null);
        setAccessToken(null);
        setUser(null);
      }
      console.error("AuthContext: Error refreshing user:", error);
    }
  };

  useEffect(() => {
    const u = user as any;
    if (u?._needsRefresh) {
      refreshUser();
    }
  }, [(user as any)?._needsRefresh]);

  const logout = async () => {
    try {
      console.log("AuthContext: Logging out...");

      // Clear state first to trigger immediate navigation
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);

      try {
        await clearToken();
        await setRefreshToken(null);
      } catch (error) {
        console.warn("AuthContext: Error clearing token (non-critical):", error);
      }

      console.log("AuthContext: Logout complete - state cleared");
    } catch (error) {
      console.error("AuthContext: Error during logout:", error);
      setAccessTokenState(null);
      setAccessToken(null);
      setUser(null);
      try {
        await setRefreshToken(null);
      } catch (_) {}
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
        googleLogin,
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

const authFallback: AuthContextType = {
  user: null,
  accessToken: null,
  loading: false,
  login: async () => {},
  googleLogin: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    return authFallback;
  }
  return ctx;
};
