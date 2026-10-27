import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  createSessionBridge,
  loadSession,
  loginWithPassword,
  logout,
  refreshSession,
  type NativeSession,
} from "./src/auth";
import { deskOrigin, PRODUCT_NAME } from "./src/config";

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [boot, setBoot] = useState(true);
  const [session, setSession] = useState<NativeSession | null>(null);
  const [deskUrl, setDeskUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = useMemo(() => deskOrigin(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (!stored || cancelled) {
        setBoot(false);
        return;
      }
      try {
        const fresh = await refreshSession(stored.refreshToken);
        if (cancelled) return;
        setSession(fresh);
        setDeskUrl(await createSessionBridge(fresh.accessToken));
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      const next = await loginWithPassword(email.trim(), password);
      setSession(next);
      setDeskUrl(await createSessionBridge(next.accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${origin}/login?next=/connect/mobile`,
        "cinem-pro://connect",
      );
      if (result.type !== "success") {
        setError("Google sign-in was cancelled.");
        return;
      }
      const url = new URL(result.url);
      const nonce = url.searchParams.get("nonce");
      if (nonce) {
        setDeskUrl(`${origin}/connect/session?nonce=${nonce}`);
        setSession({ accessToken: "cookie", refreshToken: "cookie" });
      } else {
        setDeskUrl(`${origin}/desk`);
        setSession({ accessToken: "cookie", refreshToken: "cookie" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logout(session?.refreshToken);
    setSession(null);
    setDeskUrl(null);
  }

  if (boot) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
          <StatusBar style="light" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (session && deskUrl) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.shell} edges={["top"]}>
          <View style={styles.bar}>
            <Text style={styles.barTitle}>{PRODUCT_NAME}</Text>
            <Pressable onPress={() => void onLogout()} style={styles.barBtn}>
              <Text style={styles.barBtnText}>Sign out</Text>
            </Pressable>
          </View>
          <WebView
            source={{ uri: deskUrl }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            startInLoadingState
            style={styles.webview}
          />
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.shell}>
        <View style={styles.form}>
          <Text style={styles.kicker}>{PRODUCT_NAME}</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.lead}>
            Same account as the website. After login, Mission Control opens in this app.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#8a8680"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor="#8a8680"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={() => void onLogin()} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => void onGoogle()} disabled={busy}>
            <Text style={styles.secondaryText}>Continue with Google</Text>
          </Pressable>
          <Text style={styles.hint}>Origin: {origin}</Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#09090b" },
  center: { flex: 1, backgroundColor: "#09090b", alignItems: "center", justifyContent: "center" },
  form: { flex: 1, padding: 24, justifyContent: "center" },
  kicker: { color: "#a1a1aa", fontSize: 13, marginBottom: 8 },
  title: { color: "#fafafa", fontSize: 32, fontWeight: "600" },
  lead: { color: "#a1a1aa", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  input: {
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    borderWidth: 1,
    borderRadius: 10,
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  error: { color: "#f87171", marginBottom: 12 },
  primary: { backgroundColor: "#fafafa", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#09090b", fontWeight: "600" },
  secondary: {
    borderColor: "#27272a",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#fafafa" },
  hint: { color: "#52525b", fontSize: 12, marginTop: 18 },
  bar: {
    height: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#09090b",
  },
  barTitle: { color: "#fafafa", fontWeight: "600" },
  barBtn: { padding: 8 },
  barBtnText: { color: "#a1a1aa", fontSize: 13 },
  webview: { flex: 1, backgroundColor: "#09090b" },
});
