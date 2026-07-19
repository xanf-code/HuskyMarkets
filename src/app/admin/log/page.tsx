import { ActionLog } from "@/components/admin/ActionLog";
import { getActionLog } from "@/lib/queries/admin";

export default async function AdminLogPage() {
  const rows = await getActionLog();
  return <ActionLog rows={rows} />;
}
