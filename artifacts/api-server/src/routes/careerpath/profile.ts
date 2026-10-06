import { Router, type IRouter } from "express";
import {
  GetProfileResponse,
  SaveProfileBody,
  SaveProfileResponse,
} from "@workspace/api-zod";
import {
  contextFor,
  invalidRequest,
  reportDatabaseError,
  toProfileRow,
  toStudentProfile,
} from "./shared";

const router: IRouter = Router();

router.get("/profile", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await context.supabase
    .from("profiles")
    .select("*")
    .eq("id", context.userId)
    .maybeSingle();

  if (error) return reportDatabaseError(req, res, "get_profile", error);
  if (!data) {
    return res.status(404).json({ error: "Complete onboarding to create your profile." });
  }

  const profile = toStudentProfile(data);
  if (
    !profile.name.trim() ||
    !profile.educationLevel.trim() ||
    !profile.desiredProfession.trim() ||
    !profile.careerObjective.trim()
  ) {
    return res.status(404).json({ error: "Complete onboarding to create your profile." });
  }

  return res.json(GetProfileResponse.parse(profile));
});

router.put("/profile", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res);

  const profile = parsed.data;
  if (
    !profile.name.trim() ||
    !profile.educationLevel.trim() ||
    !profile.desiredProfession.trim() ||
    !profile.careerObjective.trim()
  ) {
    return invalidRequest(res, "Add your name, education, career goal, and objective.");
  }

  const { data, error } = await context.supabase
    .from("profiles")
    .upsert(toProfileRow(profile, context.userId), { onConflict: "id" })
    .select("*")
    .single();

  if (error) return reportDatabaseError(req, res, "save_profile", error);

  return res.json(SaveProfileResponse.parse(toStudentProfile(data)));
});

export default router;
