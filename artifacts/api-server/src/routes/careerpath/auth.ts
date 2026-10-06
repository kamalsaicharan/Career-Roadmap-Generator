import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

interface CareerpathContext {
  userId: string;
  supabase: SupabaseClient;
}

const contexts = new WeakMap<Request, CareerpathContext>();

function getConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireCareerpathAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void authenticate(req, res, next);
}

async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);

  if (!match) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const config = getConfig();
  if (!config) {
    res.status(503).json({
      error:
        "Account services are not configured. Add the Supabase URL and publishable key.",
    });
    return;
  }

  const supabase = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${match[1]}` },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      res.status(401).json({ error: "Your session has expired. Sign in again." });
      return;
    }

    contexts.set(req, { userId: data.user.id, supabase });
    next();
  } catch {
    res.status(503).json({
      error: "Could not verify your session with Supabase. Try again shortly.",
    });
  }
}

export function getCareerpathContext(
  req: Request,
): CareerpathContext | undefined {
  return contexts.get(req);
}
