import React, { useMemo, useState } from "react";
import { LoginPage } from "./components/auth/LoginPage";
import { DecisionsScenariosPage } from "./components/decisions/DecisionsScenariosPage";
import { Sidebar } from "./components/layout/Sidebar";
import { OverviewPage } from "./components/overview/OverviewPage";
import { PortfolioPage } from "./components/portfolio/PortfolioPage";
import { RiskPage } from "./components/risk/RiskPage";
import { Panel } from "./components/shared/Panel";
import {
  TEST_LOGIN,
  TEST_PASSWORD,
} from "./config/constants";
import { useFearGreed } from "./hooks/useFearGreed";
import { useInvestorData } from "./hooks/useInvestorData";
import { buildPortfolioState } from "./lib/portfolioCalculations";
import { rawPositions, decisionsData, scenariosData } from "./mocks/portfolioData";
import type { Page } from "./types/portfolio";
import "./App.css";

export default function App() {
  const [page, setPage] = useState<Page>("Обзор");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const fallbackData = useMemo(
    () => buildPortfolioState(rawPositions, decisionsData, scenariosData),
    []
  );

  const investorData = useInvestorData(fallbackData);
  const data = investorData.data;
  const fearGreed = useFearGreed();
  const fearGreedData = fearGreed.data;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (login.trim() === TEST_LOGIN && password === TEST_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError("");
      setPassword("");
      setPage("Обзор");
      return;
    }

    setAuthError("Неверный логин или пароль");
  };

  const renderPage = () => {
    if (page === "Вход") {
      return (
        <LoginPage
          login={login}
          password={password}
          setLogin={setLogin}
          setPassword={setPassword}
          authError={authError}
          onSubmit={handleLogin}
        />
      );
    }

    if (!isAuthenticated) {
      return (
        <Panel tone="violet" className="p-8" hover>
          <div className="section-kicker text-violet-300">Locked</div>
          <div className="section-title">Сначала нужен вход</div>
          <div className="mt-4 text-slate-300">
            Открой раздел «Вход» слева и авторизуйся.
          </div>
        </Panel>
      );
    }

    if (investorData.isLoading && investorData.source === "fallback") {
      return (
        <Panel tone="cyan" className="p-8" hover>
          <div className="section-kicker text-cyan-300">Data sync</div>
          <div className="section-title">Синхронизация портфеля</div>
          <div className="mt-4 text-slate-300">
            Загружаем актуальные данные из investor source of truth.
          </div>
        </Panel>
      );
    }

    switch (page) {
      case "Обзор":
        return (
          <OverviewPage
            data={data}
            setPage={setPage}
            fearGreedData={fearGreedData}
            fearGreedIsLoading={fearGreed.isLoading}
            fearGreedSource={fearGreed.source}
          />
        );
      case "Портфель":
        return <PortfolioPage data={data} />;
      case "Риск":
        return <RiskPage data={data} />;
      case "Сценарии и решения":
        return <DecisionsScenariosPage data={data} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="cyber-scene"
      style={{
        minHeight: "100vh",
        color: "#eef2ff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div className="scene-orb orb-cyan" />
      <div className="scene-orb orb-violet" />
      <div className="scene-orb orb-yellow" />
      <div className="scene-plane plane-left" />
      <div className="scene-plane plane-right" />
      <div className="space-wormhole" />

      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: 24,
          display: "flex",
          gap: 24,
          position: "relative",
          zIndex: 10,
        }}
      >
        <Sidebar page={page} setPage={setPage} />
        <main style={{ flex: 1 }}>{renderPage()}</main>
      </div>
    </div>
  );
}
