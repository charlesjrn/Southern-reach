import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/AuthLayout";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Staff sign-in — Southern Reach Agency Hub" },
      { name: "description", content: "Sign in to view your roster, timesheets, leave and tasks." },
      { property: "og:title", content: "Staff sign-in — Southern Reach" },
      { property: "og:description", content: "Sign in to view your roster, timesheets, leave and tasks." },
    ],
  }),
  component: () => (
    <AuthLayout eyebrow="Staff portal" title="Welcome back" subtitle="Sign in with your work email.">
      <LoginForm portal="staff" />
    </AuthLayout>
  ),
});
