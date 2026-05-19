export const currency = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

export const percent = (n: number) => `${(Number(n || 0) * 100).toFixed(1)}%`;

export const percentDirect = (n: number) => `${Number(n || 0).toFixed(1)}%`;
