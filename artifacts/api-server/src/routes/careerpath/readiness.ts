import { Router, type IRouter } from "express";
import {
  CreateReadinessAssessmentBody,
  CreateReadinessAssessmentResponse,
  GetReadinessResponse,
} from "@workspace/api-zod";
import {
  contextFor,
  invalidRequest,
  reportDatabaseError,
} from "./shared";

const router: IRouter = Router();

const RUBRIC =
  "A self-assessment summary calculated from your ratings (0–5 per area). It is a planning aid, not a hiring prediction or guarantee of employment.";

const categories = [
  ["technicalSkills", "Technical skills"],
  ["projectQuality", "Project quality"],
  ["portfolioReadiness", "Portfolio readiness"],
  ["resumePreparation", "Resume preparation"],
  ["communication", "Communication"],
  ["interviewPreparation", "Interview preparation"],
  ["problemSolving", "Problem solving"],
  ["jobApplicationReadiness", "Job-application readiness"],
] as const;

function toReadiness(row: Record<string, any>) {
  return {
    score: Number(row.score),
    categories: row.categories ?? [],
    strengths: row.strengths ?? [],
    skillGaps: row.skill_gaps ?? [],
    nextActions: row.next_actions ?? [],
    rubric: RUBRIC,
    assessedAt: row.assessed_at,
  };
}

function readinessError(
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
    "Your readiness assessment could not be loaded or saved. Please try again.",
  );
}

router.get("/readiness", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await context.supabase
    .from("job_readiness_assessments")
    .select("score,categories,strengths,skill_gaps,next_actions,assessed_at")
    .eq("user_id", context.userId)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return readinessError(req, res, "get_readiness", error);
  if (!data) {
    return res.json(
      GetReadinessResponse.parse({
        score: null,
        categories: [],
        strengths: [],
        skillGaps: [],
        nextActions: [],
        rubric: RUBRIC,
        assessedAt: null,
      }),
    );
  }
  return res.json(GetReadinessResponse.parse(toReadiness(data)));
});

router.post("/readiness", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const parsed = CreateReadinessAssessmentBody.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, "Rate each readiness area from 0 to 5.");

  const scores = categories.map(([key, name]) => ({
    name,
    score: parsed.data[key],
    maxScore: 5 as const,
  }));
  const score =
    Math.round((scores.reduce((sum, item) => sum + item.score, 0) / scores.length) * 20 * 100) /
    100;
  const strengths = scores.filter((item) => item.score >= 4).map((item) => item.name);
  const skillGaps = scores.filter((item) => item.score <= 2).map((item) => item.name);
  const nextActions =
    skillGaps.length > 0
      ? skillGaps.map((name) => `Choose one small, measurable improvement for ${name.toLowerCase()}.`)
      : ["Keep your portfolio, resume, and interview examples current.", "Revisit this reflection after your next completed project."];

  const saved = await context.supabase.rpc("save_careerpath_readiness_assessment", {
    p_score: score,
    p_categories: scores,
    p_strengths: strengths,
    p_skill_gaps: skillGaps,
    p_next_actions: nextActions,
  });
  if (saved.error) return readinessError(req, res, "save_readiness_assessment", saved.error);

  const { data, error } = await context.supabase
    .from("job_readiness_assessments")
    .select("score,categories,strengths,skill_gaps,next_actions,assessed_at")
    .eq("id", saved.data)
    .eq("user_id", context.userId)
    .single();
  if (error) return readinessError(req, res, "read_saved_readiness_assessment", error);

  return res.status(201).json(
    CreateReadinessAssessmentResponse.parse(toReadiness(data)),
  );
});

export default router;
