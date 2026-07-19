import { ReportQueue } from "@/components/admin/ReportQueue";
import { getReportQueue } from "@/lib/queries/admin";

export default async function AdminReportsPage() {
  const items = await getReportQueue();
  return <ReportQueue items={items} />;
}
