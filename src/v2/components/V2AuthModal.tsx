import { useState, type FormEvent } from "react";
import { useAuth } from "../../hooks/useAuth";

type Tab = "signin" | "signup";

type Props = {
  initialTab?: Tab;
  onClose: () => void;
};

export function V2AuthModal({ initialTab = "signin", onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = tab === "signup";

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setNotice(null);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Введите email и пароль");
      return;
    }
    if (isSignup && !name.trim()) {
      setError("Введите имя");
      return;
    }
    if (isSignup && password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }

    setBusy(true);
    const res = isSignup
      ? await signUp(name, email, password)
      : await signIn(email, password);
    setBusy(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    if (isSignup) {
      // Если в проекте включено подтверждение email — сессии сразу не будет.
      setNotice(
        "Аккаунт создан. Если потребуется подтверждение — проверьте почту, затем войдите."
      );
      setTab("signin");
    }
    // При успешном входе onAuthStateChange закроет окно (см. useAuth-гейт).
  }

  return (
    <div className="v2-auth-overlay" role="dialog" aria-modal="true" aria-label="Авторизация">
      <div className="v2-auth-card">
        <button className="v2-auth-close" type="button" onClick={onClose} aria-label="Закрыть">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="v2-auth-head">
          <div className="v2-auth-logo">M</div>
          <div className="v2-auth-title">MUSHII INVEST</div>
          <div className="v2-auth-sub">
            {isSignup ? "Создайте аккаунт, чтобы открыть кабинет" : "Войдите в свой инвесторский кабинет"}
          </div>
        </div>

        <div className="v2-auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={!isSignup ? "v2-auth-tab is-active" : "v2-auth-tab"}
            onClick={() => switchTab("signin")}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={isSignup ? "v2-auth-tab is-active" : "v2-auth-tab"}
            onClick={() => switchTab("signup")}
          >
            Регистрация
          </button>
        </div>

        <form className="v2-auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="v2-auth-field">
              <span className="v2-auth-label">Имя</span>
              <input
                className="v2-auth-input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
              />
            </label>
          )}

          <label className="v2-auth-field">
            <span className="v2-auth-label">Email</span>
            <input
              className="v2-auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </label>

          <label className="v2-auth-field">
            <span className="v2-auth-label">Пароль</span>
            <input
              className="v2-auth-input"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "Минимум 6 символов" : "Ваш пароль"}
            />
          </label>

          {error && <div className="v2-auth-error">{error}</div>}
          {notice && <div className="v2-auth-notice">{notice}</div>}

          <button className="v2-auth-submit" type="submit" disabled={busy}>
            {busy ? "Подождите…" : isSignup ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <div className="v2-auth-switch">
          {isSignup ? (
            <>Уже есть аккаунт? <button type="button" onClick={() => switchTab("signin")}>Войти</button></>
          ) : (
            <>Нет аккаунта? <button type="button" onClick={() => switchTab("signup")}>Зарегистрироваться</button></>
          )}
        </div>
      </div>
    </div>
  );
}
