import { SemesterForm } from "@/components/admin/SemesterForm";
import { getSemesters } from "@/lib/queries/admin";

export default async function AdminSemestersPage() {
  const semesters = await getSemesters();
  return <SemesterForm semesters={semesters} />;
}
