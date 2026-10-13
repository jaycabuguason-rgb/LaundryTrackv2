import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { getPublicLoyaltyMemberRecord } from "@/lib/server/loyalty-repository";
import { MemberPassView } from "@/components/member-pass-view";

export const dynamic = "force-dynamic";

export default async function MemberLoyaltyStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getPublicLoyaltyMemberRecord(id);

  if (!record) {
    notFound();
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const memberUrl = `${protocol}://${host}/member/${record.id}`;
  const memberQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    memberUrl
  )}`;

  const formattedMemberId = `MEM-${String(record.id).padStart(4, "0")}`;

  return (
    <MemberPassView
      initialRecord={record}
      memberUrl={memberUrl}
      memberQrUrl={memberQrUrl}
      formattedMemberId={formattedMemberId}
    />
  );
}
