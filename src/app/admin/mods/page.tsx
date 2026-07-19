import { ModApplications } from "@/components/admin/ModApplications";
import { getModerators, getPendingApplications } from "@/lib/queries/admin";

export default async function AdminModsPage() {
  const [applications, moderators] = await Promise.all([
    getPendingApplications(),
    getModerators(),
  ]);
  return (
    <ModApplications applications={applications} moderators={moderators} />
  );
}
