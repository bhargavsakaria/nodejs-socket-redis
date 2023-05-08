import express, { Request, Response, NextFunction } from 'express';
import { MOBILE_ROUTER_VERSION } from '../utils/secrets';
import authRouter from '../routers/mob/auth';
import migrationRouter from '../migrations';
import membersRouter from '../routers/mob/members';
import usersRouter from '../routers/mob/user';
import { mobResponseHandler } from '../middlewares/responseHandler';
import { SERVER_VERSION } from '../utils/constants';
import { join } from 'path';
const router = express.Router();

router.use(express.json());

router.use(mobResponseHandler);

/* Server detail route to check server-availability */
router.get(`${MOBILE_ROUTER_VERSION}/server-detail`, (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.mobDeliver(
      {
        server_version: SERVER_VERSION,
        env: process.env?.NODE_ENV ?? 'DEFAULT',
        uat: process.env.UAT_ENV ?? 'NOT_UAT'
      },
      req.t('backend:success.success')
    );
  } catch (error) {
    next(error);
  }
});

router.use(`${MOBILE_ROUTER_VERSION}/auth`, authRouter);
router.use(`${MOBILE_ROUTER_VERSION}/members`, membersRouter);
router.use(`${MOBILE_ROUTER_VERSION}/user`, usersRouter);

/* Frontend messages endpoint */
router.get(`${MOBILE_ROUTER_VERSION}/translation`, (req: Request, res: Response) => {
  const language = req.headers['accept-language'] || 'en';

  const frontend_messages = require(join(__dirname, `../../src/locales/${language}/frontend.json`));

  return res.mobDeliver(frontend_messages, req.t('backend:success.success'));
});

/* Script router */
router.use(`${MOBILE_ROUTER_VERSION}/migrations`, migrationRouter);

export default router;
