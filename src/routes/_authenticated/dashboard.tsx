import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/roles";
import { errMsg } from "@/components/common";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { EmptyState, LoadingRows, PageHeader, Panel } from "@/components/common";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Southern Reach Agency Hub" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  return (
    <>
      <PageHeader title={`G'day${me?.profile?.full_name ? `, ${me.profile.full_name.split(" ")[0]}` : ""}`} description="Here's what's happening at Southern Reach." />
      {me && can.postAnnouncements(me.roles) && <PostAnnouncement authorId={me.user.id} />}
      <Panel title="Announcements">
        {isLoading ? <LoadingRows /> : data?.length ? (
          <ul className="space-y-3">
            {data.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <p className="flex items-center gap-2 font-medium"><Megaphone className="size-4 text-primary" />{a.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No announcements yet" />}
      </Panel>
    </>
  );
}

function PostAnnouncement({ authorId }: { authorId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("Add a title and message.");
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      pinned,
      author_id: authorId,
    });
    setSaving(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Announcement posted");
    setTitle("");
    setBody("");
    setPinned(false);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  };

  return (
    <Panel title="Post an announcement">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ann_title">Title</Label>
          <Input id="ann_title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ann_body">Message</Label>
          <Textarea id="ann_body" maxLength={5000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
          Pin to top
        </label>
        <Button type="submit" disabled={saving}>{saving ? "Posting…" : "Post announcement"}</Button>
      </form>
    </Panel>
  );
}
