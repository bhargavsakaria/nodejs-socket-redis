import express from 'express';
import * as migrations from './controller';
const router = express.Router();

/**
 * STEP 0
 * Add Admin
 */
router.get('/add-admin', migrations.add_admin);

/**
 * STEP 1
 * Default User (Senior)
 */
// router.get('/default-user', migrations.default_users);

/**
 * STEP 2
 * Default User (Senior's Relatives)
 */
// router.get('/default-relative', migrations.default_relatives);

/**
 * STEP 3
 * Default Support staff users (Nurse + IT support)
 */
// router.get('/default-support-staffs', migrations.default_support_users);

// Above endpoints currently blocked to avoid accidental redundancy

router.post('/add-staff', migrations.add_staff);

router.post('/assign-nurse-to-senior', migrations.assign_nurse);

router.post('/new-senior-relatives', migrations.newSeniorAndRelatives);

router.get('/revoke-all-tokens', migrations.revoke_all_tokens);

router.post('/check-db', migrations.database_access_log);

router.post('/add-notification', migrations.add_notification);

router.post('/add-call-history', migrations.addCallHistory);

export default router;
