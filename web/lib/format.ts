export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const pt = (n: number) => `${n.toLocaleString("ko-KR")}P`;
export const ymd = (d: Date | string | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 10);
};
export const ymdhm = (d: Date | string | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "-";
  return dt.toISOString().slice(0, 16).replace("T", " ");
};
