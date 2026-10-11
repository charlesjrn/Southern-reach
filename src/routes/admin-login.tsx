import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/AuthLayout";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin portal — Southern Reach Agency Hub" },
      { name: "description", content: "Sign-in for administrators, management, HR and payroll officers." },
      { property: "og:title", content: "Admin portal — Southern Reach" },
      { property: "og:description", content: "Sign-in for administrators, management, HR and payroll officers." },
    ],
  }),
  component: () => (
    <AuthLayout eyebrow="Admin portal" title="Administrator sign-in" subtitle="For System Administrators, Management, HR and Payroll Officers.">
      <LoginForm portal="admin" />
    </AuthLayout>
  ),
});
