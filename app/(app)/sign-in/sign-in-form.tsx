"use client";

import { useActionState } from "react";
import { authenticate, type AuthFormState } from "./actions";

const INITIAL: AuthFormState = { kind: "idle" };

export function SignInForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState(authenticate, INITIAL);

  if (state.kind === "check-email") {
    return (
      <div className="prose" role="status">
        <p className="message">
          <strong>Check your email.</strong>
          We sent a confirmation link to {state.email}. Open it to finish creating your account, then sign in here.
        </p>
      </div>
    );
  }

  const email = state.kind === "error" ? state.email : "";
  const error = state.kind === "error" ? state.message : notice;

  return (
    <form className="form" action={action}>
      {error && (
        <p className="message" role="alert">
          {error}
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="form-actions">
        <button className="action" type="submit" name="intent" value="sign-in" disabled={pending}>
          <span>Sign in</span>
        </button>
        <button className="text-action" type="submit" name="intent" value="sign-up" disabled={pending}>
          Create an account
        </button>
      </div>
    </form>
  );
}
