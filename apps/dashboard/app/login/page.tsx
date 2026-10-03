"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { ShaktiLogo } from "@/components/shakti-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMe } from "@/lib/api";
import { supabase, supabaseConfigured, supabaseConfigurationError } from "@/lib/supabase";
import { apiConfigurationError } from "@/lib/config";

/**
 * Operator sign-in boundary.
 *
 * Supabase Auth is the only sign-in path. The API's GET /me response is the
 * authoritative operator allowlist check; a valid citizen session is not
 * enough to enter the operator shell.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid operator email address.");
      return;
    }
    if (password.length < 1) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    if (!supabaseConfigured || apiConfigurationError) {
      setError(apiConfigurationError ?? supabaseConfigurationError ?? "Operator sign-in is unavailable until Supabase Auth is configured.");
      setLoading(false);
      return;
    }
    try {
      const client = supabase();
      if (!client) throw new Error("Supabase Auth is not configured.");
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError || !data.session) {
        setError(signInError?.message ?? "Sign-in failed. Check your credentials.");
        setLoading(false);
        return;
      }
      const identity = await getMe();
      if (!identity.is_operator) {
        await client.auth.signOut();
        setError("This account is not on the operator allowlist.");
        setLoading(false);
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Sign-in or operator verification failed. Check API/Auth configuration and connectivity, then retry.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="hidden flex-col justify-between rounded-xl bg-foreground p-8 text-background lg:flex">
          <ShaktiLogo size={44} />
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase opacity-70">
              ShaktiOS
            </p>
            <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em]">
              Safer communities, stronger together.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-7 opacity-70">
              A common operating picture for evolving safety incidents. Every signal becomes
              traceable evidence; risk is explainable before action is approved.
            </p>
          </div>
          <p className="text-xs opacity-60">Human-led response · Human-approved action</p>
        </div>

        <Card className="rounded-xl bg-card py-0 ring-0">
          <CardContent className="p-8">
            <div className="mb-5 flex items-center gap-2.5 lg:hidden">
              <ShaktiLogo size={36} />
              <span className="text-[15px] font-medium tracking-tight">ShaktiOS</span>
            </div>
            <h2 className="text-2xl font-medium tracking-[-0.03em]">Operator login</h2>
            <p className="mt-1 text-sm text-muted-foreground">Access the command center.</p>
            {(apiConfigurationError || supabaseConfigurationError) && <p className="mt-4 text-sm text-destructive" role="alert">{apiConfigurationError ?? supabaseConfigurationError}</p>}
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">
                  Email address
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="operator@shaktios.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-lg bg-muted pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg font-medium"
              >
                {loading ? "Signing in…" : "Login"}
              </Button>
            </form>
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted p-3.5 text-xs leading-6 text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Supabase Auth verifies this session, then GET /me checks the server-side operator allowlist. No demo login or client-only identity is accepted.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </main>
  );
}
