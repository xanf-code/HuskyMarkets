import { PendingQueue } from "@/components/admin/PendingQueue";
import { getPendingMarketsQueue } from "@/lib/queries/admin";

export default async function AdminPendingPage() {
  const items = await getPendingMarketsQueue();
  return <PendingQueue items={items} />;
}
