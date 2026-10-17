import type { FormEvent } from "react";
import AuthInput from "./authInput";
import PasswordInput from "./passwordInput";

type AuthFormProps = { mode: "signin" | "signup"; onSwitch: () => void };

export default function AuthForm({ mode, onSwitch }: AuthFormProps) {
  const isSignUp = mode === "signup";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Integration point: submit validated form data to the future authentication API.
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-heading">
        <p>{isSignUp ? "Start mapping what matters." : "Welcome back."}</p>
        <h1>{isSignUp ? "Create your account" : "Sign in to GeoFlare"}</h1>
      </div>
      {isSignUp && <AuthInput label="Full name" id="full-name" name="name" type="text" autoComplete="name" required />}
      <AuthInput label="Email address" id={`${mode}-email`} name="email" type="email" autoComplete="email" required />
      <PasswordInput id={`${mode}-password`} name="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={isSignUp ? 8 : undefined} required />
      <button className="auth-submit" type="submit">{isSignUp ? "Create account" : "Sign in"}</button>
      <p className="auth-switch-copy">{isSignUp ? "Already have an account?" : "New to GeoFlare?"} <button type="button" onClick={onSwitch}>{isSignUp ? "Sign in" : "Create account"}</button></p>
    </form>
  );
}
