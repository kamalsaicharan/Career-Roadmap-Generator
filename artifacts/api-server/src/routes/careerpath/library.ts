import { Router, type IRouter } from "express";
import {
  CreatePortfolioProjectBody,
  CreatePortfolioProjectResponse,
  DeletePortfolioProjectParams,
  ListPortfolioProjectsResponse,
  ListResourcesResponse,
  UpdatePortfolioProjectBody,
  UpdatePortfolioProjectParams,
  UpdatePortfolioProjectResponse,
} from "@workspace/api-zod";
import {
  contextFor,
  invalidRequest,
  notFound,
  reportDatabaseError,
  safeUrl,
} from "./shared";

const router: IRouter = Router();

function libraryError(
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
    "Your saved learning items could not be loaded or changed. Please try again.",
  );
}

function toPortfolioProject(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    skills: row.skills ?? [],
    projectUrl: row.project_url ?? null,
    repoUrl: row.repo_url ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/resources", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await context.supabase
    .from("learning_resources")
    .select("id,title,provider,url,resource_type,why_relevant")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return libraryError(req, res, "list_resources", error);

  return res.json(
    ListResourcesResponse.parse(
      (data ?? []).map((resource) => ({
        id: resource.id,
        title: resource.title,
        provider: resource.provider,
        url: resource.url,
        resourceType: resource.resource_type,
        whyRelevant: resource.why_relevant ?? "",
      })),
    ),
  );
});

router.get("/portfolio/projects", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await context.supabase
    .from("project_portfolios")
    .select("id,title,description,skills,project_url,repo_url,status,created_at,updated_at")
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return libraryError(req, res, "list_portfolio_projects", error);

  return res.json(
    ListPortfolioProjectsResponse.parse((data ?? []).map(toPortfolioProject)),
  );
});

router.post("/portfolio/projects", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const parsed = CreatePortfolioProjectBody.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, "Check the project details and try again.");

  const projectUrl =
    parsed.data.projectUrl === undefined || parsed.data.projectUrl === null
      ? null
      : safeUrl(parsed.data.projectUrl);
  const repoUrl =
    parsed.data.repoUrl === undefined || parsed.data.repoUrl === null
      ? null
      : safeUrl(parsed.data.repoUrl);
  if (
    (parsed.data.projectUrl && !projectUrl) ||
    (parsed.data.repoUrl && !repoUrl)
  ) {
    return invalidRequest(res, "Project and repository links must use http or https.");
  }

  const { data, error } = await context.supabase
    .from("project_portfolios")
    .insert({
      user_id: context.userId,
      title: parsed.data.title.trim(),
      description: parsed.data.description,
      skills: parsed.data.skills,
      project_url: projectUrl,
      repo_url: repoUrl,
      status: parsed.data.status,
    })
    .select("id,title,description,skills,project_url,repo_url,status,created_at,updated_at")
    .single();
  if (error) return libraryError(req, res, "create_portfolio_project", error);

  return res.status(201).json(
    CreatePortfolioProjectResponse.parse(toPortfolioProject(data)),
  );
});

router.patch("/portfolio/projects/:projectId", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const params = UpdatePortfolioProjectParams.safeParse(req.params);
  const parsed = UpdatePortfolioProjectBody.safeParse(req.body);
  if (!params.success) return notFound(res, "This project could not be found.");
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return invalidRequest(res, "Change at least one project detail.");
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.skills !== undefined) update.skills = parsed.data.skills;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  for (const [inputKey, column] of [
    ["projectUrl", "project_url"],
    ["repoUrl", "repo_url"],
  ] as const) {
    const value = parsed.data[inputKey];
    if (value === undefined) continue;
    if (value === null || value === "") {
      update[column] = null;
      continue;
    }
    const url = safeUrl(value);
    if (!url) return invalidRequest(res, "Project and repository links must use http or https.");
    update[column] = url;
  }

  const { data, error } = await context.supabase
    .from("project_portfolios")
    .update(update)
    .eq("id", params.data.projectId)
    .eq("user_id", context.userId)
    .select("id,title,description,skills,project_url,repo_url,status,created_at,updated_at")
    .maybeSingle();
  if (error) return libraryError(req, res, "update_portfolio_project", error);
  if (!data) return notFound(res, "This project could not be found.");

  return res.json(
    UpdatePortfolioProjectResponse.parse(toPortfolioProject(data)),
  );
});

router.delete("/portfolio/projects/:projectId", async (req, res) => {
  const context = contextFor(req);
  if (!context) return res.status(401).json({ error: "Sign in to continue." });

  const params = DeletePortfolioProjectParams.safeParse(req.params);
  if (!params.success) return notFound(res, "This project could not be found.");

  const { data, error } = await context.supabase
    .from("project_portfolios")
    .delete()
    .eq("id", params.data.projectId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle();
  if (error) return libraryError(req, res, "delete_portfolio_project", error);
  if (!data) return notFound(res, "This project could not be found.");
  return res.status(204).end();
});

export default router;
