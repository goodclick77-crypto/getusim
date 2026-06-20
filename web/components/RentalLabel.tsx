import { countryFlag, countryLabel, serviceLogo, serviceLabel } from "@/lib/config";

/** 인증 내역 표시: 서비스 로고 + 이름 · 국기 + 국가 */
export default function RentalLabel({
  country,
  service,
  phone,
}: {
  country: string;
  service: string;
  phone?: string;
}) {
  const flag = countryFlag(country);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={serviceLogo(service)} alt="" className="h-4 w-4 shrink-0" loading="lazy" />
      <span className="font-medium">{serviceLabel(service)}</span>
      <span className="text-zinc-300">·</span>
      {flag && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover shadow-sm" loading="lazy" />
      )}
      <span>{countryLabel(country)}</span>
      {phone && <span className="font-num ml-1 text-zinc-500">{phone}</span>}
    </span>
  );
}
