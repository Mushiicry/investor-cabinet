import { useRef, useState } from "react";

type Props = {
  initialName:   string;
  initialAvatar: string;
  onSave: (name: string, avatar: string) => void;
};

export function V2SettingsPage({ initialName, initialAvatar, onSave }: Props) {
  const [name,     setName]     = useState(initialName);
  const [avatar,   setAvatar]   = useState(initialAvatar);
  const [saved,    setSaved]    = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    onSave(name, avatar);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="v2-settings-page">
      <div className="v2-settings-header">
        <h1 className="v2-settings-title">Настройки</h1>
        <p className="v2-settings-sub">Персонализация платформы</p>
      </div>

      {/* Профиль */}
      <div className="v2-settings-profile-card">
        <button
          className="v2-settings-avatar-btn"
          onClick={() => fileRef.current?.click()}
          title="Загрузить фото"
        >
          {avatar
            ? <img src={avatar} alt="avatar" className="v2-settings-avatar-img" />
            : <span className="v2-settings-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="rgba(85,199,255,0.7)" strokeWidth="1.5"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(85,199,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
          }
          <span className="v2-settings-avatar-edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M16 3l5 5L7 22H2v-5L16 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleAvatarChange}
        />
        <div className="v2-settings-profile-info">
          <label className="v2-settings-card-label">Имя инвестора</label>
          <input
            className="v2-settings-name-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Введите имя..."
            maxLength={32}
          />
          <span className="v2-settings-card-desc">Отображается в профиле и в сайдбаре</span>
        </div>
        <button
          className={`v2-settings-save-btn${saved ? " is-saved" : ""}`}
          onClick={handleSave}
        >
          {saved ? "✓ Сохранено" : "Сохранить"}
        </button>
      </div>

      {/* Язык, валюта и тема раньше были переключателями, которые ничего не
          меняли: состояние жило в useState и никуда не сохранялось. Для
          продукта, построенного на доверии к цифрам, фальшивый контрол
          дороже отсутствующего — показываем текущие параметры фактами. */}
      <div className="v2-settings-grid">

        <div className="v2-settings-card">
          <div className="v2-settings-card-label">Параметры интерфейса</div>
          <div className="v2-settings-card-desc">Зафиксированы для этой версии кабинета</div>
          <dl className="v2-settings-facts">
            <div className="v2-settings-fact">
              <dt>Язык</dt>
              <dd>Русский</dd>
            </div>
            <div className="v2-settings-fact">
              <dt>Валюта учёта</dt>
              <dd>USD</dd>
            </div>
            <div className="v2-settings-fact">
              <dt>Тема</dt>
              <dd>Тёмная</dd>
            </div>
          </dl>
        </div>

      </div>
    </div>
  );
}
