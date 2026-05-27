import type { FormEvent } from "react";
import {
  TEST_LOGIN,
  TEST_PASSWORD,
} from "../../config/constants";
import { Panel } from "../shared/Panel";

type LoginPageProps = {
  login: string;
  password: string;
  setLogin: (v: string) => void;
  setPassword: (v: string) => void;
  authError: string;
  onSubmit: (e: FormEvent) => void;
};

export function LoginPage({
  login,
  password,
  setLogin,
  setPassword,
  authError,
  onSubmit,
}: LoginPageProps) {
  return (
    <div className="max-w-xl">
      <Panel tone="yellow" className="p-8" hover>
        <div className="section-kicker text-yellow-300">Access (доступ)</div>
        <div className="section-title">Вход в кабинет</div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Логин</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              placeholder="Введите логин"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none"
              placeholder="Введите пароль"
            />
          </div>

          {authError ? (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-fuchsia-200">
              {authError}
            </div>
          ) : null}

          <button type="submit" className="cyber-nav-btn cyber-nav-btn-active">Войти</button>

          <div className="text-sm text-slate-500">
            Логин: <span className="text-slate-300">{TEST_LOGIN}</span> | Пароль: <span className="text-slate-300">{TEST_PASSWORD}</span>
          </div>
        </form>
      </Panel>
    </div>
  );
}
