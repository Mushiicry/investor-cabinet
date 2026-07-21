import { useEffect } from "react";

/**
 * Закрытие оверлея клавишей Escape.
 * Слушатель висит только пока оверлей открыт — иначе вложенные модалки
 * закрывались бы разом, а закрытые перехватывали бы клавишу впустую.
 */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onClose]);
}
