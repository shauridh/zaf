import { listMembers } from "@/lib/actions/members";
import { MembersClient } from "@/components/pos/members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await listMembers();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Member</h1>
        <p className="text-sm text-stone-500">
          Poin: 1 poin per Rp10.000 belanja · 1 poin = Rp100 saat redeem.
        </p>
      </header>
      <MembersClient
        members={members.map((m) => ({
          id: m.id,
          name: m.name ?? "",
          phone: m.phone,
          points: Number(m.points),
        }))}
      />
    </div>
  );
}
