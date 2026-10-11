import { createFileRoute } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { PageHeader, Panel } from "@/components/common";
import { ROLE_LABELS } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — Southern Reach Agency Hub" }] }),
  component: Profile,
});

function Profile() {
  const { data: me } = useMe();
  return (
    <>
      <PageHeader title="My profile" />
      <Panel>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{me?.profile?.full_name}</dd></div>
          <div><dt className="text-muted-foreground">Employee ID</dt><dd className="font-medium">{me?.profile?.employee_id}</dd></div>
          <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{me?.profile?.email}</dd></div>
          <div><dt className="text-muted-foreground">Roles</dt><dd className="font-medium">{me?.roles.map((r) => ROLE_LABELS[r]).join(", ")}</dd></div>
        </dl>
      </Panel>
    </>
  );
}
