import { countryFlag, countryLabel, serviceLogo, serviceLabel } from "@/lib/config";

/** 인증 내역 표시: [서비스 로고+이름] [국기+국가] (서비스 고정폭으로 국가 시작점 정렬) */
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
    <span className="flex min-w-0 items-center gap-2 text-sm">
      {/* 서비스: 고정폭으로 국가 시작점 정렬 */}
      <span className="flex w-[5.5rem] shrink-0 items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={serviceLogo(service)} alt="" className="h-4 w-4 shrink-0" loading="lazy" />
        <span className="truncate font-medium">{serviceLabel(service)}</span>
      </span>
      {/* 국가 */}
      <span className="flex min-w-0 items-center gap-1.5 text-zinc-600">
        {flag && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flag}
            alt=""
            className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover shadow-sm"
            loading="lazy"
          />
        )}
        <span className="truncate">{countryLabel(country)}</span>
      </span>
      {phone && <span className="font-num shrink-0 text-zinc-500">{phone}</span>}
    </span>
  );
}
