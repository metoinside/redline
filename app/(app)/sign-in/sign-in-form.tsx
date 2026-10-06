"use client";

import { useActionState } from "react";
import { sendSignInLink, type AuthFormState } from "./actions";

const INITIAL: AuthFormState = { kind: "idle" };

export function SignInForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState(sendSignInLink, INITIAL);

  if (state.kind === "check-email") {
    return (
      <div className="prose" role="status">
        <p className="message">
          <strong>Check your email.</strong>
          We sent a sign-in link to {state.email}. Open it on this device, in this browser.
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
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email}
          aria-describedby="email-hint"
        />
        <p id="email-hint" className="hint">
          We’ll email you a link to sign in. If you don’t have an account yet, the link creates one.
        </p>
      </div>
      <div className="form-actions">
        <button className="action" type="submit" disabled={pending}>
          <span>Email me a sign-in link</span>
        </button>
      </div>
    </form>
  );
}
