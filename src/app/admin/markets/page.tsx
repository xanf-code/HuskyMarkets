import { AdminMarketsTable } from "@/components/admin/AdminMarketsTable";
import { getAdminMarkets } from "@/lib/queries/admin";

export default async function AdminMarketsPage() {
  const markets = await getAdminMarkets();
  return <AdminMarketsTable markets={markets} />;
}
