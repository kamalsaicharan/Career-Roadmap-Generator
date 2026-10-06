import type { Request, Response } from "express";
import { getCareerpathContext } from "./auth";

export function contextFor(req: Request) {
  return getCareerpathContext(req);
}

export function reportDatabaseError(
  req: Request,
  res: Response,
  operation: string,
  error: { code?: string } | null,
  message = "We could not save your changes. Please try again.",
) {
  req.log?.error(
    { operation, code: error?.code ?? "unknown" },
    "CareerPath database operation failed",
  );
  return res.status(503).json({ error: message });
}

export function invalidRequest(
  res: Response,
  message = "Some details need your attention. Check the form and try again.",
) {
  return res.status(400).json({ error: message });
}

export function notFound(res: Response, message = "This item could not be found.") {
  return res.status(404).json({ error: message });
}

export function toProfileRow(profile: Record<string, unknown>, userId: string) {
  return {
    id: userId,
    name: profile.name,
    education_level: profile.educationLevel,
    qualification: profile.qualification || null,
    desired_profession: profile.desiredProfession,
    current_skills: profile.currentSkills,
    skill_level: profile.skillLevel ?? "beginner",
    interests: profile.interests,
    learning_style: profile.learningStyle,
    study_minutes_per_day: profile.studyMinutesPerDay,
    target_completion_date: profile.targetCompletionDate || null,
    preferred_resources: profile.preferredResources,
    career_objective: profile.careerObjective,
    updated_at: new Date().toISOString(),
  };
}

export function toStudentProfile(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name ?? "",
    educationLevel: row.education_level ?? "",
    qualification: row.qualification ?? "",
    desiredProfession: row.desired_profession ?? "",
    currentSkills: row.current_skills ?? [],
    skillLevel: row.skill_level ?? "beginner",
    interests: row.interests ?? [],
    learningStyle: row.learning_style ?? "",
    studyMinutesPerDay: row.study_minutes_per_day ?? 60,
    targetCompletionDate: row.target_completion_date ?? null,
    preferredResources: row.preferred_resources ?? [],
    careerObjective: row.career_objective ?? "",
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function toRoadmapTask(row: Record<string, any>) {
  return {
    id: row.id,
    phaseNumber: row.phase_number,
    title: row.title,
    description: row.description ?? "",
    weekNumber: row.week_number,
    status: row.status,
    notes: row.notes ?? "",
  };
}

export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
