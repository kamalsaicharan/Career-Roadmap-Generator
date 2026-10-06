import { Router } from "express";
import { requireCareerpathAuth } from "./auth";
import libraryRouter from "./library";
import profileRouter from "./profile";
import progressRouter from "./progress";
import readinessRouter from "./readiness";
import roadmapsRouter from "./roadmaps";

const router = Router();

router.use(requireCareerpathAuth);
router.use(profileRouter);
router.use(progressRouter);
router.use(roadmapsRouter);
router.use(libraryRouter);
router.use(readinessRouter);

export default router;
