type Source = "manual" | "api" | "computed" | "mixed";

type Props = {
  source: Source;
  /** Уточнение под подсказкой: откуда именно данные. */
  title?: string;
  label?: string;
};

/**
 * Метка происхождения данных.
 * Инвестор должен различать, что система посчитала сама, что пришло из
 * внешнего источника, а что он вписал руками: доверие к числу зависит от
 * того, кто за него отвечает.
 */
const PRESET: Record<Source, { label: string; title: string }> = {
  manual: {
    label: "ваш ввод",
    title: "Заполняется вручную в таблице — система это не считает и не проверяет",
  },
  api: {
    label: "внешний API",
    title: "Данные приходят из внешнего источника и обновляются автоматически",
  },
  computed: {
    label: "расчёт",
    title: "Считает система по данным портфеля и правилам политики",
  },
  mixed: {
    label: "ваш план · цены API",
    title: "Уровни задаёте вы в таблице, текущие цены подтягиваются из внешнего источника",
  },
};

export function V2SourceTag({ source, title, label }: Props) {
  const preset = PRESET[source];

  return (
    <span className={`v2-source-tag is-${source}`} title={title ?? preset.title}>
      {label ?? preset.label}
    </span>
  );
}
