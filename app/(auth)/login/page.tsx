"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthedLandingPath } from "@/app/actions/auth-routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("登录失败，请检查邮箱和密码。Invalid email or password.");
      setLoading(false);
      return;
    }

    await router.refresh();
    router.replace(await getAuthedLandingPath());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-haidee-surface px-4">
      <Card className="w-full max-w-md border-haidee-border shadow-lg">
        <CardHeader className="space-y-3 pb-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            width={64}
            height={64}
            alt="WTL Logo"
            className="mx-auto"
          />
          <div>
            <h1 className="text-xl font-bold text-haidee-text">
              海利物流有限公司
            </h1>
            <p className="text-sm text-haidee-muted">
              HAI DEE LOGISTICS CO.,LTD
            </p>
          </div>
          <p className="text-xs text-haidee-accent">Powered by DMC SYSTEM</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-haidee-text">
                邮箱 Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@haideelogistics.com"
                required
                autoComplete="email"
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-haidee-text">
                密码 Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="min-h-[44px]"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="min-h-[44px] w-full bg-haidee-blue text-white hover:bg-haidee-blue/90"
            >
              {loading ? "登录中… Signing in…" : "登录 Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-haidee-muted">
        © 2026 DMC SYSTEM. All Rights Reserved.
      </p>
    </div>
  );
}
