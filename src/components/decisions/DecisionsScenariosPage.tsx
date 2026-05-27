import { useMemo, useState } from "react";
import {
  getAttackMetricClass,
  getRiskMetricClass,
  statusTone,
} from "../../lib/uiHelpers";
import { buildPlaybookCards } from "../../lib/playbookSelectors";
import type { PortfolioState } from "../../types/portfolio";
import { CryptoLogo } from "../crypto/CryptoLogo";
import { Panel } from "../shared/Panel";

export function DecisionsScenariosPage({ data }: { data: PortfolioState }) {
  const [openAsset, setOpenAsset] = useState<string>("");

  const mergedCards = useMemo(
    () => buildPlaybookCards(data.decisions, data.scenarios),
    [data.decisions, data.scenarios]
  );

  const openCard = mergedCards.find((item) => item.asset === openAsset) ?? null;

  return (
    <div className="space-y-6">
      <Panel tone="violet" className="p-6" hover>
        <div className="section-kicker text-violet-300">PLAYBOOK</div>
        <div className="section-title">Сценарии и решения</div>
        <div className="playbook-hero-text">
          Главный экран - сетка игровых карт. Клик по карте открывает полный тактический лист по активу: почему держим, что ждём, как действуем при росте и при падении.
        </div>
      </Panel>

      <div className="playbook-grid playbook-grid-tabletop">
        {mergedCards.map((item) => {
          const tone = statusTone(item.status);
          const cardClass = item.asset === "BTC" ? "playbook-card-boss" : `playbook-card-rarity-${item.rarity}`;

          return (
            <button
              key={item.asset}
              type="button"
              className={`playbook-card playbook-card-tabletop ${cardClass}`}
              onClick={() => setOpenAsset(item.asset)}
            >
              <div className="playbook-card-frame" />
              <div className="playbook-card-header-row playbook-card-header-row-centered">
                <span className={`playbook-status-pill playbook-status-pill-${tone}`}>{item.status}</span>
              </div>

              <div className="playbook-tabletop-artwrap">
                <CryptoLogo asset={item.asset} className={`playbook-tabletop-glyph playbook-tabletop-glyph-${item.rarity}`} />
                <div className="playbook-card-nameplate">{item.asset}</div>
              </div>

              <div className="playbook-tabletop-stats">
                <div className={`playbook-stat-ball playbook-stat-ball-attack ${getAttackMetricClass(item.attack)}`}>
                  <span className="playbook-stat-label">Прибыль</span>
                  <span className="playbook-stat-value">{item.attack}</span>
                </div>
                <div className="playbook-tabletop-desc">
                  <div className="playbook-preview-label">Тезис</div>
                  <div className="playbook-preview-text">{item.thesis}</div>
                </div>
                <div className={`playbook-stat-ball playbook-stat-ball-risk ${getRiskMetricClass(item.risk)}`}>
                  <span className="playbook-stat-label">Риск</span>
                  <span className="playbook-stat-value">{item.risk}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {openCard ? (
        <div className="playbook-overlay" onClick={() => setOpenAsset("")}>
          <div
            className={`playbook-modal-card playbook-card ${openCard.asset === "BTC" ? "playbook-card-boss" : `playbook-card-rarity-${openCard.rarity}`}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="playbook-card-frame" />
            <div className="playbook-card-open-top">
              <div className="playbook-card-open-left">
                <div className="playbook-card-open-title-row">
                  <CryptoLogo asset={openCard.asset} className={`playbook-tabletop-glyph playbook-tabletop-glyph-${openCard.rarity} is-large`} />
                  <div>
                    <div className="playbook-card-symbol">{openCard.asset}</div>
                  </div>
                </div>
              </div>

              <div className="playbook-card-side">
                <button type="button" className="playbook-overlay-close" onClick={() => setOpenAsset("")}>
                  Закрыть
                </button>
              </div>
            </div>

            <div className="playbook-open-status-row">
              <span className={`playbook-status-pill playbook-status-pill-${statusTone(openCard.status)}`}>{openCard.status}</span>
            </div>

            <div className="playbook-open-stats-row playbook-open-stats-row-extended">
              <div className={`playbook-open-stat playbook-open-stat-attack ${getAttackMetricClass(openCard.attack)}`}>
                <span className="playbook-open-stat-title">Прибыль</span>
                <span className="playbook-open-stat-value">{openCard.attack}/10</span>
              </div>
              <div className={`playbook-open-stat playbook-open-stat-risk ${getRiskMetricClass(openCard.risk)}`}>
                <span className="playbook-open-stat-title">Риск</span>
                <span className="playbook-open-stat-value">{openCard.risk}/10</span>
              </div>
              <div className="playbook-open-stat playbook-open-stat-text">
                <span className="playbook-open-stat-title">База</span>
                <span className="playbook-open-stat-text-value">{openCard.base}</span>
              </div>
              <div className="playbook-open-stat playbook-open-stat-text">
                <span className="playbook-open-stat-title">Роль</span>
                <span className="playbook-open-stat-text-value">{openCard.whyHold}</span>
              </div>
            </div>

            <div className="playbook-card-body is-open">
              <div className="playbook-card-body-inner">
                <div className="playbook-detail-grid playbook-detail-grid-scenario">
                  <div className="playbook-detail-block playbook-detail-block-scenario-down">
                    <div className="playbook-detail-title playbook-detail-title-down">Сценарий <span className="playbook-scenario-arrow-down" aria-hidden="true">↓</span></div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.bear}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-scenario-up">
                    <div className="playbook-detail-title playbook-detail-title-up">Сценарий <span className="playbook-scenario-arrow-up" aria-hidden="true">↑</span></div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.bull}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-action-down">
                    <div className="playbook-detail-title playbook-detail-title-action-down">Решение</div>
                    <div className="playbook-detail-text playbook-detail-text-large playbook-detail-action-text">{openCard.nextAction}</div>
                  </div>

                  <div className="playbook-detail-block playbook-detail-block-action-up">
                    <div className="playbook-detail-title playbook-detail-title-action-up">Решение</div>
                    <div className="playbook-detail-text playbook-detail-text-large playbook-detail-action-text">{openCard.action}</div>
                  </div>

                  <div className="playbook-detail-block">
                    <div className="playbook-detail-title">Пересмотр</div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.reviewTrigger}</div>
                  </div>

                  <div className="playbook-detail-block">
                    <div className="playbook-detail-title">Инвалидация</div>
                    <div className="playbook-detail-text playbook-detail-text-large">{openCard.invalidation}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
