import { FormEvent, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type Mode = "login" | "signup";

export default function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const authError =
      mode === "login"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, displayName);

    setSubmitting(false);

    if (authError) {
      setError(authError);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. You are now signed in.");
    }
  }

  return (
    <section className="card">
      <div className="tabs">
        <button
          type="button"
          className={mode === "login" ? "tab active" : "tab"}
          onClick={() => {
            setMode("login");
            setError(null);
            setMessage(null);
          }}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === "signup" ? "tab active" : "tab"}
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
        >
          Sign up
        </button>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label>
            Your name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Tobi"
              autoComplete="name"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && <p className="feedback error">{error}</p>}
        {message && <p className="feedback success">{message}</p>}

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </section>
  );
}
