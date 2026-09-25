"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { Button, Input } from "@/components/ui";

const initialState: LoginState = { error: null };

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      {!configured ? (
        <div className="notice notice-warning" role="alert">
          Sign-in is temporarily unavailable. Contact your administrator.
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <Input
          autoComplete="email"
          autoCapitalize="none"
          id="email"
          maxLength={254}
          name="email"
          placeholder="you@company.com"
          required
          spellCheck={false}
          startIcon={<Mail size={18} />}
          type="email"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">Password</label>
        <Input
          autoComplete="current-password"
          id="password"
          maxLength={1024}
          minLength={8}
          name="password"
          placeholder="Enter your password"
          required
          startIcon={<LockKeyhole size={18} />}
          type="password"
        />
      </div>

      {state.error ? <p className="notice notice-error" role="alert">{state.error}</p> : null}

      <Button
        className="w-full"
        disabled={!configured}
        loading={pending}
        type="submit"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
        ) : (
          <ArrowRight aria-hidden="true" size={18} />
        )}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
