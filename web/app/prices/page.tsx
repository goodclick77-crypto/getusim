import { redirect } from "next/navigation";

// 가격표 메뉴는 상품 상세(국가별 실시간 가격)로 대체됐다. 예전 링크·즐겨찾기는 상품 목록으로 보낸다.
export default function PricesPage() {
  redirect("/products");
}
