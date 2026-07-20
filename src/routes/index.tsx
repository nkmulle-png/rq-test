import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  Clock,
  Lock,
  Star,
  ExternalLink,
  KeyRound,
  Sparkles,
  ShoppingBag,
  Pencil,
} from "lucide-react";
import { platformClasses, platformShort, formatDuration } from "@/lib/platform";
import rosterIllustration from "@/assets/roster-illustration.svg";
import bannerIllustration from "@/assets/banner-illustration.svg";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Course = {
  id: string;
  topic_id: string;
  title: string;
  platform: string;
  duration_minutes: number;
  thumbnail_url: string | null;
  course_url: string | null;
};
type Topic = { id: string; tier: string; name: string; sort_order: number };
type Enrollment = {
  id: string;
  topic_id: string;
  course_id: string;
  committed_at: string;
  completed_at: string | null;
  rating: number | null;
  comment: string | null;
};
type LoginInfo = {
  id: string;
  team: string;
  platform: string;
  username: string | null;
  password: string | null;
  notes: string | null;
};

function HomePage() {
  const { loading, session, appUser } = useAuth();
  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;
  if (!appUser) return <NotOnRoster email={session.user.email ?? ""} />;
  // Training Not Required users skip course selection entirely.
  if (appUser.tier === "Training Not Required") return <Navigate to="/manager" />;
  return <Catalog appUser={appUser} />;
}

function NotOnRoster({ email }: { email: string }) {
  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-2xl bg-[#DCE7F5] px-6 py-12 sm:px-12 sm:py-16 md:grid-cols-2 md:gap-6 md:px-16">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
            You're not on the roster yet
          </h1>
          <p className="mt-6 text-sm text-foreground sm:text-base">
            We couldn't find <span className="font-semibold">{email}</span> in the RDHQ training roster. Please reach out to Annmarie and Dora to be added.
          </p>
        </div>
        <img
          src={rosterIllustration}
          alt=""
          aria-hidden="true"
          className="pointer-events-none mx-auto w-full max-w-md md:ml-auto md:mr-0"
        />
      </div>
    </div>
  );
}

function Catalog({ appUser }: { appUser: AppUser }) {
  const qc = useQueryClient();

  const topicsQ = useQuery({
    queryKey: ["topics", appUser.tier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .eq("tier", appUser.tier as any)
        .order("sort_order");
      if (error) throw error;
      return data as Topic[];
    },
  });

  const coursesQ = useQuery({
    queryKey: ["courses", appUser.tier],
    enabled: !!topicsQ.data,
    queryFn: async () => {
      const ids = topicsQ.data!.map((t) => t.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .in("topic_id", ids);
      if (error) throw error;
      return data as Course[];
    },
  });

  const enrollQ = useQuery({
    queryKey: ["enrollments", appUser.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("app_user_id", appUser.id);
      if (error) throw error;
      return data as Enrollment[];
    },
  });

  // All login info rows for the user's team + 'All teams' fallback.
  const loginsQ = useQuery({
    queryKey: ["login-info", appUser.department],
    queryFn: async () => {
      const teams = ["All teams"];
      if (appUser.department) teams.push(appUser.department);
      const { data, error } = await supabase
        .from("login_information")
        .select("*")
        .in("team", teams);
      if (error) throw error;
      return data as LoginInfo[];
    },
  });

  // Pick best login per platform: prefer dept-specific over 'All teams'.
  const loginByPlatform = useMemo(() => {
    const m = new Map<string, LoginInfo>();
    loginsQ.data?.forEach((row) => {
      const existing = m.get(row.platform);
      if (!existing || (existing.team === "All teams" && row.team !== "All teams")) {
        m.set(row.platform, row);
      }
    });
    return m;
  }, [loginsQ.data]);

  const enrollByTopic = useMemo(() => {
    const m = new Map<string, Enrollment[]>();
    enrollQ.data?.forEach((e) => {
      const arr = m.get(e.topic_id) ?? [];
      arr.push(e);
      m.set(e.topic_id, arr);
    });
    return m;
  }, [enrollQ.data]);

  const totals = useMemo(() => {
    const total = topicsQ.data?.length ?? 0;
    const topicsWithCommit = topicsQ.data
      ? topicsQ.data.filter((t) => (enrollByTopic.get(t.id)?.length ?? 0) > 0).length
      : 0;
    const committedCourses = enrollQ.data?.length ?? 0;
    const completed = enrollQ.data?.filter((e) => e.completed_at).length ?? 0;
    return { total, committed: committedCourses, topicsWithCommit, completed };
  }, [topicsQ.data, enrollQ.data, enrollByTopic]);

  const allCommitted =
    !!topicsQ.data && topicsQ.data.length > 0 && totals.topicsWithCommit >= totals.total;

  const allTopicsCompleted =
    !!topicsQ.data &&
    topicsQ.data.length > 0 &&
    topicsQ.data.every((t) =>
      (enrollByTopic.get(t.id) ?? []).some((e) => e.completed_at),
    );

  const [completeFor, setCompleteFor] = useState<{ enr: Enrollment; course: Course } | null>(null);
  // View mode: 'plan' shows committed plan; 'browse' shows shopping experience.
  const [mode, setMode] = useState<"plan" | "browse" | null>(null);
  // Local selections in browse mode: topicId -> array of selected courseIds.
  // Users must pick at least one course per topic, and may optionally pick more.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [committing, setCommitting] = useState(false);
  // When set, BrowseView jumps directly to this topic instead of starting at 0.
  // When set, BrowseView shows ONLY that topic (focused edit from PlanView).
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);

  // Default the mode once data is loaded.
  useEffect(() => {
    if (mode !== null || !topicsQ.data || !enrollQ.data) return;
    setMode(allCommitted ? "plan" : "browse");
  }, [mode, topicsQ.data, enrollQ.data, allCommitted]);

  // Seed/refresh local selections from existing enrollments whenever we enter browse mode.
  useEffect(() => {
    if (mode !== "browse" || !enrollQ.data) return;
    const next: Record<string, string[]> = {};
    enrollQ.data.forEach((e) => {
      const arr = next[e.topic_id] ?? [];
      if (!arr.includes(e.course_id)) arr.push(e.course_id);
      next[e.topic_id] = arr;
    });
    setSelections(next);
  }, [mode, enrollQ.data]);

  async function commitPlan() {
    if (!topicsQ.data) return;
    setCommitting(true);
    try {
      for (const topic of topicsQ.data) {
        const selected = selections[topic.id] ?? [];
        const existing = enrollByTopic.get(topic.id) ?? [];
        const existingIds = new Set(existing.map((e) => e.course_id));

        // Insert any newly-selected courses not yet enrolled.
        const toInsert = selected.filter((cid) => !existingIds.has(cid));
        if (toInsert.length > 0) {
          const { error } = await supabase.from("enrollments").insert(
            toInsert.map((cid) => ({
              app_user_id: appUser.id,
              topic_id: topic.id,
              course_id: cid,
            })),
          );
          if (error) throw error;
        }

        // Remove any previously-committed (but not completed) enrollments the user deselected.
        const toRemove = existing.filter(
          (e) => !e.completed_at && !selected.includes(e.course_id),
        );
        for (const e of toRemove) {
          const { error } = await supabase.from("enrollments").delete().eq("id", e.id);
          if (error) throw error;
        }
      }
      await qc.invalidateQueries({ queryKey: ["enrollments", appUser.id] });
      toast.success("Training plan committed!");
      setMode("plan");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to commit plan.");
    } finally {
      setCommitting(false);
    }
  }

  if (topicsQ.isLoading || coursesQ.isLoading || enrollQ.isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading your courses…</div>;
  }

  const topics = topicsQ.data ?? [];
  const courses = coursesQ.data ?? [];
  // Every topic must have at least one selection (or an existing enrollment) before committing.
  const allSelected =
    topics.length > 0 &&
    topics.every(
      (t) =>
        (selections[t.id]?.length ?? 0) > 0 ||
        (enrollByTopic.get(t.id)?.length ?? 0) > 0,
    );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="relative overflow-hidden rounded-2xl bg-[#d8e4f4] px-8 py-10 sm:px-12">
        <div className="relative z-10 max-w-2xl">
          {appUser.title && (
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary">
              {appUser.title}
            </span>
          )}
          <h1 className="mt-6 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {allTopicsCompleted
              ? `Congrats ${appUser.name.split(" ")[0]}, you've completed your required training!`
              : mode === "plan"
              ? `Hi ${appUser.name.split(" ")[0]}, here's your training plan.`
              : `Hi ${appUser.name.split(" ")[0]}, choose your courses.`}
          </h1>
          <p className="mt-3 text-base text-foreground/70">
            {allTopicsCompleted
              ? "Feel free to keep exploring — add more courses to any topic whenever you'd like."
              : mode === "plan"
              ? "Open a course to get started. Not feeling it? Swap it out. Want more? Add extra courses to any topic. Mark complete when you're done."
              : "Select at least one course per topic. Feel free to add more courses if you’d like."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BannerStat label="Topics" value={totals.total} />
            <BannerStat label="Committed" value={totals.committed} />
            <BannerStat label="Completed" value={totals.completed} />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full select-none md:block"
        >
          <img
            src={bannerIllustration}
            alt=""
            className="h-full w-auto object-contain object-right animate-[fade-in_0.7s_ease-out_0.1s_both]"
          />
        </div>
      </div>

      {mode === "browse" ? (
        <BrowseView
          topics={topics}
          courses={courses}
          selections={selections}
          enrollByTopic={enrollByTopic}
          onToggle={(topicId, courseId) =>
            setSelections((s) => {
              const current = s[topicId] ?? [];
              const next = current.includes(courseId)
                ? current.filter((id) => id !== courseId)
                : [...current, courseId];
              return { ...s, [topicId]: next };
            })
          }
          allCommitted={allCommitted}
          onBackToPlan={() => {
            setFocusTopicId(null);
            setMode("plan");
          }}
          onCommit={commitPlan}
          allSelected={allSelected}
          committing={committing}
          focusTopicId={focusTopicId}
        />
      ) : (
        <PlanView
          topics={topics}
          courses={courses}
          enrollByTopic={enrollByTopic}
          loginByPlatform={loginByPlatform}
          onBrowse={(topicId) => {
            setFocusTopicId(topicId ?? null);
            setMode("browse");
          }}
          onComplete={(enr, course) => setCompleteFor({ enr, course })}
        />
      )}

      {completeFor && (
        <CompleteDialog
          open={!!completeFor}
          onClose={() => setCompleteFor(null)}
          course={completeFor.course}
          enrollmentId={completeFor.enr.id}
          onDone={() => {
            setCompleteFor(null);
            qc.invalidateQueries({ queryKey: ["enrollments", appUser.id] });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </main>
  );
}

function BannerStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[110px] rounded-xl bg-white/70 px-5 py-3">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
        {label}
      </div>
    </div>
  );
}

function BrowseView({
  topics,
  courses,
  selections,
  enrollByTopic,
  onToggle,
  allCommitted,
  onBackToPlan,
  onCommit,
  allSelected,
  committing,
  focusTopicId,
}: {
  topics: Topic[];
  courses: Course[];
  selections: Record<string, string[]>;
  enrollByTopic: Map<string, Enrollment[]>;
  onToggle: (topicId: string, courseId: string) => void;
  allCommitted: boolean;
  onBackToPlan: () => void;
  onCommit: () => void;
  allSelected: boolean;
  committing: boolean;
  focusTopicId: string | null;
}) {
  const focused = !!focusTopicId;
  const focusedTopic = focused ? topics.find((t) => t.id === focusTopicId) ?? null : null;
  // Topics that have at least one selection or completed enrollment.
  const selectedCount = topics.filter(
    (t) =>
      (selections[t.id]?.length ?? 0) > 0 ||
      (enrollByTopic.get(t.id)?.some((e) => e.completed_at) ?? false),
  ).length;
  // Total individual course selections across all topics.
  const totalCourseSelections = topics.reduce(
    (sum, t) => sum + (selections[t.id]?.length ?? 0),
    0,
  );

  // Stepper: one topic at a time, then a review step at the end.
  const [step, setStep] = useState(0);
  const totalSteps = topics.length + 1; // last step = review
  const isReview = step >= topics.length;
  const currentTopic = focused ? focusedTopic : !isReview ? topics[step] : null;
  const topRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef(false);

  const goToStep = (nextStep: number | ((prev: number) => number), shouldScroll = true) => {
    pendingScrollRef.current = shouldScroll;
    setStep(nextStep);
  };

  // Scroll the topic header into view only after user-driven topic changes.
  useEffect(() => {
    if (!pendingScrollRef.current) {
      return;
    }
    pendingScrollRef.current = false;
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const courseById = useMemo(() => {
    const m = new Map<string, Course>();
    courses.forEach((c) => m.set(c.id, c));
    return m;
  }, [courses]);

  // Keep step in range if topics change.
  useEffect(() => {
    if (focused) return;
    if (step > topics.length) goToStep(topics.length, false);
  }, [topics.length, step, focused]);

  const currentSelectedIds = currentTopic ? selections[currentTopic.id] ?? [] : [];
  const currentCompletedIds = currentTopic
    ? new Set(
        (enrollByTopic.get(currentTopic.id) ?? [])
          .filter((e) => e.completed_at)
          .map((e) => e.course_id),
      )
    : new Set<string>();
  const canAdvance = isReview
    ? false
    : currentSelectedIds.length > 0 || currentCompletedIds.size > 0;

  // Focused single-topic edit mode (entered via "Swap"/"Add" from PlanView).
  if (focused && focusedTopic) {
    const topic = focusedTopic;
    const topicCourses = courses.filter((c) => c.topic_id === topic.id);
    const completedIds = currentCompletedIds;
    const selectedIds = new Set(currentSelectedIds);
    const pickedCount = selectedIds.size;
    return (
      <>
        <div ref={topRef} className="mt-8 scroll-mt-6">
          <button
            type="button"
            onClick={onBackToPlan}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to my plan
          </button>
          <div className="mt-4 flex items-center gap-2 text-primary">
            <ShoppingBag className="h-5 w-5" />
            <h1 className="text-xs font-semibold uppercase tracking-wider">Edit courses for this topic</h1>
          </div>
          <h2 className="mt-2 text-xl font-semibold">{topic.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pickedCount === 0
              ? "Select at least one course. Feel free to add more if you'd like."
              : `${pickedCount} selected. Add more from this topic if you like.`}
          </p>
        </div>

        <div className="mt-8 pb-32">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {topicCourses.map((c) => {
              const isSelected = selectedIds.has(c.id);
              const isCompleted = completedIds.has(c.id);
              return (
                <Card
                  key={c.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border p-0 transition"
                  style={{
                    boxShadow: isSelected ? "var(--shadow-card-hover)" : "var(--shadow-card)",
                    outline: isSelected ? "2px solid var(--primary)" : "none",
                  }}
                >
                  <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                    {c.thumbnail_url && (
                      <img
                        src={c.thumbnail_url}
                        alt={c.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                    <span
                      className={`absolute left-3 bottom-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${platformClasses(c.platform)}`}
                    >
                      {platformShort(c.platform)}
                    </span>
                    {isSelected && (
                      <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Selected
                      </Badge>
                    )}
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground">
                      {c.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(c.duration_minutes)}
                    </div>
                    <div className="mt-auto flex flex-col gap-2 pt-3">
                      {c.course_url && (
                        <Button asChild variant="outline" className="w-full rounded-full border-foreground/20 font-semibold">
                          <a href={c.course_url} target="_blank" rel="noreferrer">
                            Preview Course <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant={isSelected ? "secondary" : "default"}
                        className="w-full rounded-md font-semibold"
                        disabled={isCompleted}
                        onClick={() => onToggle(topic.id, c.id)}
                      >
                        {isCompleted
                          ? "Completed"
                          : isSelected
                          ? "Remove"
                          : "Select This Course"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <Button variant="outline" size="sm" onClick={onBackToPlan}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              size="lg"
              onClick={onCommit}
              disabled={pickedCount === 0 || committing}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {committing ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mt-8 flex items-start justify-between gap-4">
        <div />
        {allCommitted && (
          <Button variant="ghost" size="sm" onClick={onBackToPlan}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to my plan
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div ref={topRef} className="mt-6 scroll-mt-24">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((isReview ? totalSteps : step) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-8 pb-32">
        {currentTopic && (() => {
          const topic = currentTopic;
          const topicCourses = courses.filter((c) => c.topic_id === topic.id);
          const completedIds = currentCompletedIds;
          const selectedIds = new Set(currentSelectedIds);
          const pickedCount = selectedIds.size;
          return (
            <section key={topic.id}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Topic {step + 1} of {topics.length}
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <h2 className="text-[24px] font-bold tracking-normal">{topic.name}</h2>
                    <div className="flex items-baseline gap-3 text-[12px]">
                      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                        {pickedCount} selected
                      </span>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="font-medium text-primary">
                        {pickedCount === 0
                          ? "Select at least one course."
                          : "Feel free to add more courses if you'd like."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {topicCourses.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const isCompleted = completedIds.has(c.id);
                  return (
                    <Card
                      key={c.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border p-0 transition"
                      style={{
                        boxShadow: isSelected
                          ? "var(--shadow-card-hover)"
                          : "var(--shadow-card)",
                        outline: isSelected ? "2px solid var(--primary)" : "none",
                      }}
                    >
                      <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                        {c.thumbnail_url && (
                          <img
                            src={c.thumbnail_url}
                            alt={c.title}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        )}
                        <span
                          className={`absolute left-3 bottom-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${platformClasses(c.platform)}`}
                        >
                          {platformShort(c.platform)}
                        </span>
                        {isSelected && (
                          <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Selected
                          </Badge>
                        )}
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-3 p-5">
                        <h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground">
                          {c.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {formatDuration(c.duration_minutes)}
                        </div>
                        <div className="mt-auto flex flex-col gap-2 pt-3">
                          {c.course_url && (
                            <Button asChild variant="outline" className="w-full rounded-full border-foreground/20 font-semibold">
                              <a href={c.course_url} target="_blank" rel="noreferrer">
                                Preview Course <ExternalLink className="ml-1 h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant={isSelected ? "secondary" : "default"}
                            className="w-full rounded-md font-semibold"
                            disabled={isCompleted}
                            onClick={() => onToggle(topic.id, c.id)}
                          >
                            {isCompleted
                              ? "Completed"
                              : isSelected
                              ? "Remove"
                              : "Select This Course"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {isReview && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Review your training plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Here's what you've picked. Feel free to change anything before you commit. You can also swap, add, and remove courses later.
              </p>
            </div>
            <div className="divide-y divide-border border-t border-b">
              {topics.map((t, i) => {
                const enrolled = enrollByTopic.get(t.id) ?? [];
                const enrolledIds = new Set(enrolled.map((e) => e.course_id));
                const pickedIds = selections[t.id] ?? [];
                const allIds = Array.from(new Set([...pickedIds, ...enrolledIds]));
                const courseList = allIds
                  .map((id) => courseById.get(id))
                  .filter((c): c is Course => !!c);
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[200px_1fr_auto] items-start gap-6 py-5"
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">{t.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {courseList.length} {courseList.length === 1 ? "course" : "courses"}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {courseList.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No course selected.
                        </div>
                      ) : (
                        courseList.map((c) => (
                          <div key={c.id} className="flex flex-col gap-1">
                            <div className="text-sm font-medium leading-snug text-foreground">
                              {c.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${platformClasses(c.platform)}`}
                              >
                                {platformShort(c.platform)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(c.duration_minutes)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Change
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={step === 0}
              onClick={() => goToStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedCount}</span> / {topics.length} topics covered
              {totalCourseSelections > selectedCount && (
                <span className="ml-2">· {totalCourseSelections} courses picked</span>
              )}
            </div>
          </div>
          {isReview ? (
            <Button
              size="lg"
              onClick={onCommit}
              disabled={!allSelected || committing}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {committing ? "Committing…" : "Commit to all courses"}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => goToStep((s) => s + 1)}
              disabled={!canAdvance}
              className="gap-2"
            >
              {step === topics.length - 1 ? "Review picks" : "Next topic"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function PlanView({
  topics,
  courses,
  enrollByTopic,
  loginByPlatform,
  onBrowse,
  onComplete,
}: {
  topics: Topic[];
  courses: Course[];
  enrollByTopic: Map<string, Enrollment[]>;
  loginByPlatform: Map<string, LoginInfo>;
  onBrowse: (topicId?: string) => void;
  onComplete: (enr: Enrollment, course: Course) => void;
}) {
  const courseById = useMemo(() => {
    const m = new Map<string, Course>();
    courses.forEach((c) => m.set(c.id, c));
    return m;
  }, [courses]);

  return (
    <>
      <div className="mt-16 space-y-14">
        {topics.map((topic) => {
          const enrs = enrollByTopic.get(topic.id) ?? [];
          const total = enrs.length;
          const completed = enrs.filter((e) => e.completed_at).length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <section key={topic.id}>
              <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {topic.name}
                </h2>
                {total > 0 && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {total} {total === 1 ? "course" : "courses"}
                    <span className="mx-2 text-muted-foreground/50">|</span>
                    {pct}% complete
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onBrowse(topic.id)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Add, swap, or remove courses
                </button>
              </div>
              {enrs.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No course selected yet.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {enrs.map((enr) => {
                    const course = courseById.get(enr.course_id);
                    if (!course) return null;
                    return (
                      <Card
                        key={enr.id}
                        className="flex flex-col overflow-hidden p-0 sm:flex-row"
                        style={{ boxShadow: "var(--shadow-card)" }}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden bg-muted sm:aspect-auto sm:w-2/5 sm:shrink-0">
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className={`h-full w-full object-cover transition-all ${enr.completed_at ? "opacity-75 grayscale" : ""}`}
                      />
                    )}
                    <Badge className={`absolute left-3 top-3 ${enr.completed_at ? "bg-muted text-muted-foreground" : platformClasses(course.platform)}`}>
                      {platformShort(course.platform)}
                    </Badge>
                    {enr.completed_at && (
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          Completed{" "}
                          {new Date(enr.completed_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  <CardContent className={`flex flex-1 flex-col gap-3 p-4 sm:p-6 ${enr.completed_at ? "text-muted-foreground" : ""}`}>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(course.duration_minutes)}
                    </div>
                    {(() => {
                      const li = loginByPlatform.get(course.platform);
                      if (!li) return null;
                      return (
                        <div className="rounded-md bg-secondary p-3 text-xs">
                          <div className="mb-1 flex items-center gap-1 font-medium text-secondary-foreground">
                            <KeyRound className="h-3 w-3" /> {li.platform} login
                          </div>
                          {li.username && (
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">User:</span> {li.username}
                            </div>
                          )}
                          {li.password && (
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Pass:</span> {li.password}
                            </div>
                          )}
                          {li.notes && (
                            <div className="mt-1 text-muted-foreground">{li.notes}</div>
                          )}
                        </div>
                      );
                    })()}
                    {enr.completed_at && enr.rating && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < (enr.rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {course.course_url && (
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <a href={course.course_url} target="_blank" rel="noreferrer">
                            Open <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {!enr.completed_at && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => onComplete(enr, course)}
                        >
                          Mark complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function CompleteDialog({
  open,
  onClose,
  course,
  enrollmentId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  enrollmentId: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (rating < 1) return toast.error("Please give a star rating.");
    if (comment.trim().length < 3) return toast.error("Add a short comment.");
    setSaving(true);
    const { error } = await supabase
      .from("enrollments")
      .update({
        completed_at: new Date().toISOString(),
        rating,
        comment: comment.trim().slice(0, 1000),
      })
      .eq("id", enrollmentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marked complete!");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark complete: {course.title}</DialogTitle>
          <DialogDescription>
            Once submitted, this course will be locked in and can't be removed or swapped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium">Your rating<span className="text-red-500"> *</span></div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const n = i + 1;
                return (
                  <button key={n} onClick={() => setRating(n)} type="button" aria-label={`${n} stars`}>
                    <Star
                      className={`h-7 w-7 transition ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Comment<span className="text-red-500"> *</span></div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you take away from this course?"
              rows={4}
              maxLength={1000}
            />
          </div>
          <div className="text-xs text-muted-foreground"><span className="text-red-500">*</span> required</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
