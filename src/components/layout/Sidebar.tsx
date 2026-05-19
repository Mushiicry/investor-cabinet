import { Panel } from "../shared/Panel";
import type { Page } from "../../types/portfolio";

type SidebarProps = {
  page: Page;
  setPage: (page: Page) => void;
};

export function Sidebar({ page, setPage }: SidebarProps) {
  const items: Page[] = ["Обзор", "Портфель", "Риск", "Сценарии и решения", "Вход"];
  return (
    <aside className="w-full lg:w-72 shrink-0">
      <Panel tone="violet" className="p-4 lg:sticky lg:top-6" hover>
        <div className="px-3 py-3 mb-4">
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">PATCH 6</div>
          <div className="text-[34px] leading-none font-black mt-4 text-white">Кабинет</div>
          <div className="text-[34px] leading-none font-black text-white/90">инвестора</div>
        </div>
        <nav className="space-y-2">
          {items.map((item) => {
            const active = page === item;
            return (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`cyber-nav-btn ${active ? "cyber-nav-btn-active" : ""}`}
              >
                {item}
              </button>
            );
          })}
        </nav>
      </Panel>
    </aside>
  );
}
