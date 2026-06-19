"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adjustPoint, InsufficientPointError } from "@/lib/points";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { fivesimPriceToPoint } from "@/lib/config";

function err(msg: string): never {
  redirect(`/sms?error=${encodeURIComponent(msg)}`);
}

/** 가상번호 구매 + 포인트 차감 */
export async function rentNumber(formData: FormData) {
  const user = await requireUser();
  const country = String(formData.get("country") || "").trim();
  const operator = String(formData.get("operator") || "any").trim() || "any";
  const product = String(formData.get("product") || "").trim();
  if (!country || !product) err("국가와 서비스를 입력하세요.");

  let order;
  try {
    order = await fivesim.buyActivation(country, operator, product);
  } catch (e) {
    if (e instanceof FiveSimError) err(`번호 구매 실패: ${e.message}`);
    throw e;
  }

  const pricePoint = fivesimPriceToPoint(order.price);

  try {
    await prisma.$transaction(async (tx) => {
      const rental = await tx.numberRental.create({
        data: {
          userId: user.id,
          provider: "5sim",
          fivesimId: String(order.id),
          country,
          operator,
          service: product,
          phoneNumber: order.phone,
          pricePoint,
          status: "PENDING",
          expiresAt: order.expires ? new Date(order.expires) : null,
        },
      });
      await adjustPoint(
        {
          userId: user.id,
          amount: -pricePoint,
          reason: `SMS 인증 번호구매 (${product}/${country})`,
          relType: "rental",
          relId: rental.id,
        },
        tx,
      );
    });
  } catch (e) {
    // 포인트 부족 등 → 5sim 주문 취소(환불)
    try {
      await fivesim.cancel(order.id);
    } catch {}
    if (e instanceof InsufficientPointError) err("포인트가 부족합니다.");
    throw e;
  }

  revalidatePath("/sms");
  redirect("/sms?ok=1");
}

/** 수신 SMS 확인 */
export async function checkSms(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const rental = await prisma.numberRental.findFirst({
    where: { id, userId: user.id },
  });
  if (!rental?.fivesimId) err("내역을 찾을 수 없습니다.");

  try {
    const order = await fivesim.check(rental.fivesimId);
    const sms = order.sms?.[order.sms.length - 1];
    if (sms) {
      await prisma.numberRental.update({
        where: { id: rental.id },
        data: { status: "RECEIVED", smsCode: sms.code, smsText: sms.text },
      });
    }
  } catch (e) {
    if (e instanceof FiveSimError) err(`확인 실패: ${e.message}`);
    throw e;
  }
  revalidatePath("/sms");
  redirect("/sms");
}

/** 인증 완료 처리 */
export async function finishRental(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const rental = await prisma.numberRental.findFirst({
    where: { id, userId: user.id },
  });
  if (!rental?.fivesimId) err("내역을 찾을 수 없습니다.");
  try {
    await fivesim.finish(rental.fivesimId);
  } catch {}
  await prisma.numberRental.update({
    where: { id: rental.id },
    data: { status: "FINISHED" },
  });
  revalidatePath("/sms");
  redirect("/sms");
}

/** 취소 + 포인트 환불 (SMS 미수신 시) */
export async function cancelRental(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const rental = await prisma.numberRental.findFirst({
    where: { id, userId: user.id },
  });
  if (!rental?.fivesimId) err("내역을 찾을 수 없습니다.");
  if (rental.status !== "PENDING") err("이미 처리된 내역입니다.");

  try {
    await fivesim.cancel(rental.fivesimId);
  } catch {}

  await prisma.$transaction(async (tx) => {
    await tx.numberRental.update({
      where: { id: rental.id },
      data: { status: "CANCELED" },
    });
    await adjustPoint(
      {
        userId: user.id,
        amount: rental.pricePoint,
        reason: `SMS 인증 취소 환불 (${rental.service})`,
        relType: "rental",
        relId: rental.id,
      },
      tx,
    );
  });
  revalidatePath("/sms");
  redirect("/sms");
}
