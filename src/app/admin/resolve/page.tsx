import { ResolveQueue } from "@/components/admin/ResolveQueue";
import { getResolveQueue } from "@/lib/queries/admin";

export default async function AdminResolvePage() {
  const items = await getResolveQueue();
  return <ResolveQueue items={items} />;
}
