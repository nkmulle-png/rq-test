import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import tnrIllustration from "@/assets/tnr-illustration.svg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ChevronDown, Clock, Copy, Download, ExternalLink, Eye, EyeOff, Library, Lock, Star, Users } from "lucide-react";
import { platformClasses, platformShort, formatDuration } from "@/lib/platform";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

export const Route = createFileRoute("/manager")({
  component: ManagerPage,
  head: () => ({
    meta: [
      { title: "Manager View — RDHQ Training Portal" },
      { name: "description", content: "Track training progress across your team." },
    ],
  }),
});

type Person = {
  id: string;
  email: string;
  name: string;
  tier: string;
  title: string | null;
  department: string | null;
  manager_email: string | null;
};
type EnrRow = {
  id: string;
  app_user_id: string;
  topic_id: string;
  course_id: string;
  completed_at: string | null;
  rating: number | null;
  comment: string | null;
  topics: { name: string; tier: string } | null;
  courses: { title: string; platform: string } | null;
};

function ManagerPage() {
  const { loading, session, appUser, isManager } = useAuth();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tnrView, setTnrView] = useState<"library" | "team">("library");

  const reportsQ = useQuery({
    queryKey: ["manager-reports", appUser?.id],
    enabled: !!appUser,
    queryFn: async () => {
      // RLS lets us see anyone we manage (recursively via is_manager_of)
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .neq("id", appUser!.id);
      if (error) throw error;
      return data as Person[];
    },
  });

  const enrollmentsQ = useQuery({
    queryKey: ["manager-enrollments", appUser?.id],
    enabled: !!reportsQ.data,
    queryFn: async () => {
      const ids = reportsQ.data!.map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, topics(name,tier), courses(title,platform)")
        .in("app_user_id", ids);
      if (error) throw error;
      return data as EnrRow[];
    },
  });

  // topic count per tier (to compute "fully complete")
  const topicCountsQ = useQuery({
    queryKey: ["topic-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("tier");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((t: { tier: string }) => {
        counts[t.tier] = (counts[t.tier] ?? 0) + 1;
      });
      return counts;
    },
  });

  const reports = reportsQ.data ?? [];
  const enrollments = enrollmentsQ.data ?? [];
  const topicCounts = topicCountsQ.data ?? {};

  const byPerson = new Map<string, EnrRow[]>();
  enrollments.forEach((e) => {
    const list = byPerson.get(e.app_user_id) ?? [];
    list.push(e);
    byPerson.set(e.app_user_id, list);
  });

  const personStatus = (p: Person) => {
    const list = byPerson.get(p.id) ?? [];
    const total = topicCounts[p.tier] ?? 0;
    const completed = list.filter((e) => e.completed_at).length;
    if (list.length === 0) return { label: "Not started", tone: "not", completed, total };
    if (total > 0 && completed >= total) return { label: "Complete", tone: "done", completed, total };
    return { label: "In progress", tone: "progress", completed, total };
  };

  const filtered = reports.filter((p) => {
    if (tierFilter !== "all" && p.tier !== tierFilter) return false;
    if (departmentFilter !== "all" && (p.department ?? "") !== departmentFilter) return false;
    if (
      q &&
      !`${p.name} ${p.email} ${p.title ?? ""} ${p.department ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false;
    if (statusFilter !== "all" && personStatus(p).tone !== statusFilter) return false;
    return true;
  });

  const stats = (() => {
    let committed = 0;
    let complete = 0;
    let notStarted = 0;
    reports.forEach((p) => {
      const s = personStatus(p);
      if (s.tone === "done") complete++;
      else if (s.tone === "not") notStarted++;
      else committed++;
    });
    return { total: reports.length, committed, complete, notStarted };
  })();

  const tiers = Array.from(new Set(reports.map((p) => p.tier)));
  const departments = Array.from(
    new Set(reports.map((p) => p.department).filter((d): d is string => !!d && d.trim() !== "")),
  ).sort();

  const exportCSV = () => {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const maxTopics = filtered.reduce((m, p) => {
      const n = (byPerson.get(p.id) ?? []).length;
      return n > m ? n : m;
    }, 0);
    const baseCols = ["First name", "Last name", "Email", "Department", "Tier", "Manager email"];
    const topicCols: string[] = [];
    for (let i = 1; i <= maxTopics; i++) {
      topicCols.push(
        `Topic ${i}`,
        `Topic ${i} course`,
        `Topic ${i} platform`,
        `Topic ${i} status`,
        `Topic ${i} completion date`,
        `Topic ${i} rating`,
        `Topic ${i} feedback`,
      );
    }
    const header = [...baseCols, ...topicCols];
    const rows = filtered.map((p) => {
      const parts = (p.name ?? "").trim().split(/\s+/);
      const first = parts.shift() ?? "";
      const last = parts.join(" ");
      const base = [first, last, p.email, p.department ?? "", p.tier, p.manager_email ?? ""];
      const enrs = byPerson.get(p.id) ?? [];
      const topicData: string[] = [];
      for (let i = 0; i < maxTopics; i++) {
        const e = enrs[i];
        if (!e) {
          topicData.push("", "", "", "", "", "", "");
        } else {
          topicData.push(
            e.topics?.name ?? "",
            e.courses?.title ?? "",
            e.courses?.platform ?? "",
            e.completed_at ? "Complete" : "In progress",
            e.completed_at ? new Date(e.completed_at).toISOString().slice(0, 10) : "",
            e.rating != null ? String(e.rating) : "",
            e.comment ?? "",
          );
        }
      }
      return [...base, ...topicData];
    });
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;
  const isTNR = appUser?.tier === "Training Not Required";
  const hasReports = (reportsQ.data?.length ?? 0) > 0;

  // TNR with no direct reports → just the course library (with greeting).
  if (isTNR && !hasReports) {
    return <CourseLibrary greetingName={appUser?.name ?? null} />;
  }

  // TNR with reports & library view → show library with greeting + CTA + toggle.
  if (isTNR && hasReports && tnrView === "library") {
    return (
      <CourseLibrary
        greetingName={appUser?.name ?? null}
        onViewTeam={() => setTnrView("team")}
        toggle={
          <TnrToggle view={tnrView} setView={setTnrView} />
        }
      />
    );
  }

  if (!isManager)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Manager View</h1>
        <p className="mt-3 text-muted-foreground">You don't have any direct reports in the roster.</p>
      </div>
    );
  // Non-TNR manager with no reports yet → show the standard empty state.
  if (!isTNR && !hasReports && !reportsQ.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Team progress</h1>
        <p className="mt-3 text-muted-foreground">No direct reports found in the roster yet.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {isTNR && hasReports && (
        <div className="mb-6">
          <TnrToggle view={tnrView} setView={setTnrView} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-accent p-3 text-accent-foreground">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Team progress</h1>
          <p className="text-sm text-muted-foreground">Everyone in your reporting tree.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total people" value={stats.total} />
        <StatCard label="In progress" value={stats.committed} />
        <StatCard label="Fully complete" value={stats.complete} accent />
        <StatCard label="Not started" value={stats.notStarted} />
      </div>

      <Card className="mt-8 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="max-w-xs"
          />
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {tiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="not">Not started</SelectItem>
              <SelectItem value="progress">In progress</SelectItem>
              <SelectItem value="done">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="ml-auto"
          >
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Progress</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const s = personStatus(p);
                const open = expanded === p.id;
                return (
                  <>
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.title ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.department ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.tier}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${s.total ? (s.completed / s.total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{s.completed}/{s.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={s.tone === "done" ? "default" : s.tone === "not" ? "outline" : "secondary"}
                          className="whitespace-nowrap"
                        >
                          {s.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(open ? null : p.id)}
                        >
                          {open ? "Hide" : "View"} details
                        </Button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-muted/30">
                        <td colSpan={7} className="px-4 py-4">
                          <PersonDetails rows={byPerson.get(p.id) ?? []} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No people match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
}

function PersonDetails({ rows }: { rows: EnrRow[] }) {
  if (rows.length === 0)
    return <div className="text-sm text-muted-foreground">No course selections yet.</div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.topics?.name}</div>
              <div className="mt-0.5 font-medium">{r.courses?.title}</div>
              <div className="mt-1 flex items-center gap-2">
                {r.courses && (
                  <Badge className={platformClasses(r.courses.platform)}>{platformShort(r.courses.platform)}</Badge>
                )}
                {r.completed_at ? (
                  <Badge variant="default">Complete</Badge>
                ) : (
                  <Badge variant="secondary">In progress</Badge>
                )}
              </div>
            </div>
          </div>
          {r.completed_at && (
            <div className="mt-3 rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < (r.rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
                  />
                ))}
              </div>
              {r.comment && <p className="mt-2 text-sm italic text-muted-foreground">"{r.comment}"</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type LibCourse = {
  id: string;
  title: string;
  platform: string;
  duration_minutes: number;
  thumbnail_url: string | null;
  course_url: string | null;
  topic_id: string;
};
type LibTopic = { id: string; tier: string; name: string; sort_order: number };

type LoginInfoRow = {
  team: string;
  platform: string;
  username: string | null;
  password: string | null;
  notes: string | null;
};

function LoginInfoDropdown({ rows }: { rows: LoginInfoRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1 border-t pt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-xs">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" /> Login information
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No login information available for your team on this platform.
          </p>
        ) : (
          rows.map((row, i) => <LoginRowView key={i} row={row} showTeam={rows.length > 1} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LoginRowView({ row, showTeam }: { row: LoginInfoRow; showTeam: boolean }) {
  const [showPw, setShowPw] = useState(false);
  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed"),
    );
  };
  return (
    <div className="rounded-md bg-muted/40 p-2 text-xs">
      {showTeam && (
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {row.team}
        </div>
      )}
      {row.username && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-muted-foreground">User: </span>
            <span className="break-all font-mono">{row.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0"
            onClick={() => copy(row.username!, "Username")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
      {row.password && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-muted-foreground">Pass: </span>
            <span className="break-all font-mono">{showPw ? row.password : "••••••••"}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copy(row.password!, "Password")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {row.notes && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
          {row.notes}
        </p>
      )}
    </div>
  );
}

function TnrToggle({
  view,
  setView,
}: {
  view: "library" | "team";
  setView: (v: "library" | "team") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-1">
      <Button
        variant={view === "library" ? "default" : "ghost"}
        size="sm"
        onClick={() => setView("library")}
      >
        <Library className="mr-1 h-4 w-4" /> Course library
      </Button>
      <Button
        variant={view === "team" ? "default" : "ghost"}
        size="sm"
        onClick={() => setView("team")}
      >
        <Users className="mr-1 h-4 w-4" /> Team progress
      </Button>
    </div>
  );
}

function CourseLibrary({
  greetingName,
  onViewTeam,
  toggle,
}: {
  greetingName?: string | null;
  onViewTeam?: () => void;
  toggle?: ReactNode;
} = {}) {
  const { appUser } = useAuth();
  const topicsQ = useQuery({
    queryKey: ["lib-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("tier")
        .order("sort_order");
      if (error) throw error;
      return data as LibTopic[];
    },
  });
  const coursesQ = useQuery({
    queryKey: ["lib-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*");
      if (error) throw error;
      return data as LibCourse[];
    },
  });
  const loginQ = useQuery({
    queryKey: ["lib-login-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_information")
        .select("team, platform, username, password, notes");
      if (error) throw error;
      return data as LoginInfoRow[];
    },
  });

  if (topicsQ.isLoading || coursesQ.isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading course library…</div>;
  }
  const topics = topicsQ.data ?? [];
  const courses = coursesQ.data ?? [];
  const allLogins = loginQ.data ?? [];
  const dept = appUser?.department ?? null;
  // Prefer team-specific rows; fall back to "All teams" only when none exist for that platform.
  const loginsByPlatform = new Map<string, LoginInfoRow[]>();
  const teamSpecific = new Map<string, LoginInfoRow[]>();
  const fallback = new Map<string, LoginInfoRow[]>();
  allLogins.forEach((row) => {
    if (dept && row.team === dept) {
      const list = teamSpecific.get(row.platform) ?? [];
      list.push(row);
      teamSpecific.set(row.platform, list);
    } else if (row.team === "All teams") {
      const list = fallback.get(row.platform) ?? [];
      list.push(row);
      fallback.set(row.platform, list);
    }
  });
  const platforms = new Set([...teamSpecific.keys(), ...fallback.keys()]);
  platforms.forEach((p) => {
    loginsByPlatform.set(p, teamSpecific.get(p) ?? fallback.get(p) ?? []);
  });
  const byTier = new Map<string, LibTopic[]>();
  topics.forEach((t) => {
    const list = byTier.get(t.tier) ?? [];
    list.push(t);
    byTier.set(t.tier, list);
  });
  const orderedTierEntries = Array.from(byTier.entries()).sort(([a], [b]) => {
    if (a === "New Hire") return -1;
    if (b === "New Hire") return 1;
    return 0;
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {toggle && <div className="mb-6">{toggle}</div>}
      {greetingName ? (
        <div className="mb-8 overflow-hidden rounded-2xl bg-[#dbe5f7] p-8 sm:p-10 md:pb-0 md:pr-0">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Hi {greetingName.split(" ")[0]},
              </h1>
              <p className="mt-4 text-foreground/90">
                You are not required to complete any training courses.
              </p>
              <p className="mt-3 text-foreground/90">
                Feel free to explore what's available. Browse courses and monitor your
                team's progress.
              </p>
              {onViewTeam && (
                <Button className="mt-6" onClick={onViewTeam}>
                  View team progress <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-end justify-center self-end md:justify-end">
              <img
                src={tnrIllustration}
                alt=""
                className="block w-full max-w-md md:max-w-xl lg:max-w-2xl"
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-accent p-3 text-accent-foreground">
          <Library className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Course library</h1>
          <p className="text-sm text-muted-foreground">
            Browse all courses across every tier.&nbsp;
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-12">
        {orderedTierEntries.map(([tier, tierTopics]) => (
          <section key={tier}>
            <h2 className="mb-4 text-lg font-semibold">{tier}</h2>
            {tierTopics.map((topic) => {
              const topicCourses = courses.filter((c) => c.topic_id === topic.id);
              return (
                <div key={topic.id} className="mb-8">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {topic.name}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {topicCourses.map((c) => (
                      <Card key={c.id} className="flex flex-col overflow-hidden p-0">
                        <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                          {c.thumbnail_url && (
                            <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <Badge className={`w-fit ${platformClasses(c.platform)}`}>
                            {platformShort(c.platform)}
                          </Badge>
                          <h4 className="line-clamp-2 text-sm font-semibold">{c.title}</h4>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatDuration(c.duration_minutes)}
                          </div>
                          {c.course_url && (
                            <Button asChild variant="outline" size="sm" className="mt-auto">
                              <a href={c.course_url} target="_blank" rel="noreferrer">
                                Preview <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          <LoginInfoDropdown rows={loginsByPlatform.get(c.platform) ?? []} />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
