"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Command, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveAccessToken, supabase, supabaseConfigured } from "@/lib/supabase";

/**
 * Operator sign-in boundary.
 *
 * With NEXT_PUBLIC_SUPABASE_URL + publishable key configured, this signs in
 * through Supabase Auth and stores the session token, which the API verifies
 * (see services/api auth.py + GET /me). Without those keys it keeps the
 * previous demo behavior: session identity in localStorage only.
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
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid operator email address.");
      return;
    }
    if (password.length < 4) {
      setError("Enter your password (minimum 4 characters for this demo boundary).");
      return;
    }
    setLoading(true);
    try {
      if (supabaseConfigured) {
        const client = supabase();
        const { data, error: signInError } = await client!.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError || !data.session) {
          setError(signInError?.message ?? "Sign-in failed. Check your credentials.");
          setLoading(false);
          return;
        }
        saveAccessToken(data.session.access_token);
        try {
          localStorage.setItem("shaktios-operator-email", data.session.user.email ?? email.trim());
          localStorage.setItem(
            "shaktios-operator-name",
            (data.session.user.email ?? email.trim()).split("@")[0] ?? "Operator",
          );
        } catch {
          // Session identity is best-effort.
        }
      } else {
        saveAccessToken(null);
        try {
          localStorage.setItem("shaktios-operator-email", email.trim());
          localStorage.setItem("shaktios-operator-name", email.trim().split("@")[0] ?? "Operator");
        } catch {
          // Session identity is best-effort; the dashboard works without it.
        }
      }
    } catch {
      setError("Sign-in failed. Is the auth service reachable?");
      setLoading(false);
      return;
    }
    setTimeout(() => router.push("/dashboard"), 400);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="hidden flex-col justify-between rounded-[1.75rem] bg-foreground p-8 text-background lg:flex">
          <span className="flex size-11 items-center justify-center rounded-[1.1rem] bg-background text-foreground">
            <Command className="size-5" aria-hidden />
          </span>
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

        <Card className="rounded-[1.75rem] bg-card py-0 ring-0">
          <CardContent className="p-8">
            <h2 className="text-2xl font-medium tracking-[-0.03em]">Operator login</h2>
            <p className="mt-1 text-sm text-muted-foreground">Access the command center.</p>
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
                  className="h-11 rounded-2xl bg-muted"
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
                    className="h-11 rounded-2xl bg-muted pr-11"
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
                className="h-11 w-full rounded-full font-medium"
              >
                {loading ? "Signing in…" : "Login"}
              </Button>
            </form>
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-muted p-3.5 text-xs leading-6 text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {supabaseConfigured
                  ? "Signed in through Supabase Auth — the API verifies this session (GET /me). Citizen clients use the same identity provider."
                  : "Demo session boundary only — Supabase keys are not configured, so no real authentication happens yet. Citizen clients authenticate with Supabase Auth; operator SSO remains a backend/security gap."}
              </p>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              <Link href="/dashboard" className="font-medium text-info hover:underline">
                Continue to the command center →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
