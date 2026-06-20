import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const passwordConfirm = String(form.get("passwordConfirm") || "");

  const uid = await verifyResetToken(token);
  if (!uid) return redirectTo("/find-password?error=expired");

  const keep = `?t=${encodeURIComponent(token)}`;
  if (password.length < 6) return redirectTo(`/find-password/reset${keep}&error=short`);
  if (password !== passwordConfirm)
    return redirectTo(`/find-password/reset${keep}&error=mismatch`);

  await prisma.user.update({
    where: { id: uid },
    data: { passwordHash: await hashPassword(password), legacyHash: null },
  });

  return redirectTo("/login?reset=1");
}
