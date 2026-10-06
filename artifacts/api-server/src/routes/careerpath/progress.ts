import { Router, type IRouter } from "express";
import {
  CreateStudySessionBody,
  CreateStudySessionResponse,
  GetDashboardResponse,
  ListStudySessionsResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import {
  contextFor,
  invalidRequest,
  notFound,
  reportDatabaseError,
  toRoadmapTask,
} from "./shared";

const router: IRouter = Router();

function progressError(
  req: Parameters<typeof reportDatabaseError>[0],
  res: Parameters<typeof reportDatabaseError>[1],
  operation: string,
  error: { code?: string } | null,
) {
  return reportDatabaseError(
    req,
    res,
    operation,
    error,
    "Your progress could not be loaded or saved. Please try again.",
  );
}

router.get("/dashboard", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const [profileResult, roadmapResult, portfolioResult, readinessResult] =
    await Promise.all([
      context.supabase
        .from("profiles")
        .select("name")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("roadmaps")
        .select("id,career_title")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("project_portfolios")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      context.supabase
        .from("job_readiness_assessments")
        .select("score")
        .eq("user_id", context.userId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (profileResult.error) return progressError(req, res, "dashboard_profile", profileResult.error);
  if (roadmapResult.error) return progressError(req, res, "dashboard_roadmap", roadmapResult.error);
  if (portfolioResult.error) return progressError(req, res, "dashboard_portfolio", portfolioResult.error);
  if (readinessResult.error) return progressError(req, res, "dashboard_readiness", readinessResult.error);

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);

  const sessionsPromise = context.supabase
    .from("study_sessions")
    .select("minutes,started_at")
    .eq("user_id", context.userId)
    .gte("started_at", weekStart.toISOString())
    .order("started_at", { ascending: true });
  const tasksPromise = roadmapResult.data
    ? context.supabase
        .from("roadmap_tasks")
        .select("id,phase_number,title,description,week_number,status,notes")
        .eq("user_id", context.userId)
        .eq("roadmap_id", roadmapResult.data.id)
        .order("week_number", { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const [sessionsResult, tasksResult] = await Promise.all([sessionsPromise, tasksPromise]);
  if (sessionsResult.error) return progressError(req, res, "dashboard_study_sessions", sessionsResult.error);
  if (tasksResult.error) return progressError(req, res, "dashboard_tasks", tasksResult.error);

  const weekly = new Map<string, number>();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(weekStart);
    day.setUTCDate(weekStart.getUTCDate() + offset);
    weekly.set(day.toISOString().slice(0, 10), 0);
  }
  for (const session of sessionsResult.data ?? []) {
    const date = String(session.started_at).slice(0, 10);
    if (weekly.has(date)) weekly.set(date, (weekly.get(date) ?? 0) + session.minutes);
  }

  const taskRows = tasksResult.data ?? [];
  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((task) => task.status === "completed").length;
  const upcomingTasks = taskRows
    .filter((task) => task.status !== "completed")
    .slice(0, 5)
    .map(toRoadmapTask);

  return res.json(
    GetDashboardResponse.parse({
      profileName: profileResult.data?.name ?? "",
      activeCareer: roadmapResult.data?.career_title ?? null,
      completedTasks,
      totalTasks,
      completionPercentage:
        totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
      portfolioCount: portfolioResult.count ?? 0,
      weeklyProgress: Array.from(weekly.entries()).map(([date, minutes]) => ({
        date,
        minutes,
      })),
      upcomingTasks,
      readinessScore: readinessResult.data?.score ?? null,
    }),
  );
});

router.patch("/tasks/:taskId", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const params = UpdateTaskParams.safeParse(req.params);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!params.success) return notFound(res, "This task could not be found.");
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return invalidRequest(res, "Choose a task status or add a note.");
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.completed_at =
      parsed.data.status === "completed" ? new Date().toISOString() : null;
  }
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  const { data, error } = await context.supabase
    .from("roadmap_tasks")
    .update(update)
    .eq("id", params.data.taskId)
    .eq("user_id", context.userId)
    .select("id,phase_number,title,description,week_number,status,notes")
    .maybeSingle();

  if (error) return progressError(req, res, "update_task", error);
  if (!data) return notFound(res, "This task could not be found.");
  return res.json(UpdateTaskResponse.parse(toRoadmapTask(data)));
});

router.get("/study-sessions", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await context.supabase
    .from("study_sessions")
    .select("id,minutes,note,started_at")
    .eq("user_id", context.userId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) return progressError(req, res, "list_study_sessions", error);

  return res.json(
    ListStudySessionsResponse.parse(
      (data ?? []).map((session) => ({
        id: session.id,
        minutes: session.minutes,
        note: session.note ?? "",
        startedAt: session.started_at,
      })),
    ),
  );
});

router.post("/study-sessions", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const parsed = CreateStudySessionBody.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, "Enter a study duration between 1 minute and 24 hours.");

  let roadmapId: string | null = null;
  const taskId = parsed.data.taskId ?? null;
  if (taskId) {
    const task = await context.supabase
      .from("roadmap_tasks")
      .select("id,roadmap_id")
      .eq("id", taskId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (task.error) return progressError(req, res, "find_session_task", task.error);
    if (!task.data) return notFound(res, "The selected task could not be found.");
    roadmapId = task.data.roadmap_id;
  }

  const { data, error } = await context.supabase
    .from("study_sessions")
    .insert({
      user_id: context.userId,
      roadmap_id: roadmapId,
      task_id: taskId,
      minutes: parsed.data.minutes,
      note: parsed.data.note,
    })
    .select("id,minutes,note,started_at")
    .single();
  if (error) return progressError(req, res, "create_study_session", error);

  return res.status(201).json(
    CreateStudySessionResponse.parse({
      id: data.id,
      minutes: data.minutes,
      note: data.note ?? "",
      startedAt: data.started_at,
    }),
  );
});

export default router;
