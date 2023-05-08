import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { ENVIRONMENT, MOBILE_ROUTER_PREFIX } from './utils/secrets';
import passport from 'passport';
import apiErrorHandler from './middlewares/apiErrorHandler';
import apiContentType from './middlewares/apiContentType';
import { webResponseHandler } from './middlewares/responseHandler';
import { jwt, mob, local } from './passport/config';
// import firebase from './helpers/firebase';

// import userRouter from './routers/user';
// import loginRouter from './routers/login';
// import serviceRouter from './routers/service';
// import emailRouter from './routers/email';
// import webhookRouter from './routers/webhook';
// import alertRouter from './routers/alert';
// import couponRouter from './routers/coupon';
// import blogRouter from './routers/blog';

import mobileParentRouter from './v1';
import mobApiErrorHandler from './middlewares/mob/mobApiErrorHandler';
import * as Sentry from '@sentry/node';

// Multi lingual support
import i18next from 'i18next';
import i18nBackend from 'i18next-fs-backend';
import * as i18nMiddleware from 'i18next-http-middleware';
import { join } from 'path';
import defaultErrorHandler from './middlewares/mob/defaultErrorHandler';

i18next
  .use(i18nBackend)
  .use(i18nMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    ns: ['joi', 'backend', 'frontend'],
    backend: { loadPath: join(__dirname, '../src/locales/{{lng}}/{{ns}}.json') }
  });

const app = express();
// console.log('APP IS IN ENVIRONMENT ', ENVIRONMENT);

// express configuration
// Sentry.init({
//   enabled: ENVIRONMENT === 'production',
//   dsn: 'https://34ad4ba611a94cbcae905a0899c76432@o1133056.ingest.sentry.io/6179219',
//   integrations: [
//     // enable HTTP calls tracing
//     new Sentry.Integrations.Http({ tracing: true })
//   ],
//   environment: process.env.NODE_ENV,

//   // Set tracesSampleRate to 1.0 to capture 100%
//   // of transactions for performance monitoring.
//   // We recommend adjusting this value in production
//   tracesSampleRate: 1.0
// });

// Firebase Initializer
// firebase.init();

app.use(i18nMiddleware.handle(i18next));

// app.set('port', process.env.PORT || 5000);

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
// app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
// app.use(Sentry.Handlers.tracingHandler());

// app.use(express.json())

// use common 3rd-party middleware
app.use(cors());
app.use(compression());
// passport
// app.use(passport.initialize());
// passport.use(local);
// passport.use(jwt);
// passport.use('jwt-mob', mob);

app.use(webResponseHandler);

// routers
// app.use('/user', userRouter);
// app.use('/', loginRouter);
// app.use('/services', serviceRouter);
// app.use('/email', emailRouter);
// app.use('/webhook', webhookRouter);
// app.use('/alerts', alertRouter);
// app.use('/coupons', couponRouter);
// app.use('/blogs', blogRouter);

// custom API error handler
app.use(apiErrorHandler);
app.use(apiContentType);

// Mobile API parent router
app.use(MOBILE_ROUTER_PREFIX, mobileParentRouter);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

app.use(defaultErrorHandler);
app.use(mobApiErrorHandler);

export default app;
