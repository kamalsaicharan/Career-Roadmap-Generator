import { Router, type IRouter } from "express";
import healthRouter from "./health";
import careerpathRouter from "./careerpath";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/careerpath", careerpathRouter);

export default router;
