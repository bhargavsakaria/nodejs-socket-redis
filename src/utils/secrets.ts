import dotenv from 'dotenv';
import fs from 'fs';
import { ConnectionOptions } from 'typeorm';

import logger from './logger';
import Entities from '../entities';

if (fs.existsSync('.env')) {
  logger.debug('Using .env file to supply config environment variables');
  dotenv.config({ path: '.env' });
} else {
  logger.error('Please make a .env file');
}

export const ENVIRONMENT = process.env.NODE_ENV;
const prod = ENVIRONMENT === 'production'; // Anything else is treated as 'dev'

const JWT_SECRET = process.env['JWT_SECRET'] as string;
const DB_PASSWORD = process.env['DB_PASSWORD'] as string;
const DB_USERNAME = process.env['DB_USERNAME'] as string;
const STRIPE_API_KEY = process.env['STRIPE_API_KEY'] as string;
export const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] as string;
export const POSTI_USERNAME = process.env['POSTI_USERNAME'] as string;
export const POSTI_PASSWORD = process.env['POSTI_PASSWORD'] as string;
export const POSTI_CUSTOMER_NUMBER = (process.env['POSTI_CUSTOMER_NUMBER'] as string) || '321456';
export const LOCALE = (process.env['LOCALE'] as string) || 'FI';

let ormConfig;
let hostname = 'http://localhost:3000';
let posti_url = 'https://api.unifaun.com/rs-extapi/v1';
if (prod) {
  const dbUrl = process.env.DATABASE_URL;
  ormConfig = {
    type: 'postgres',
    synchronize: true,
    logging: false,
    entities: Entities,
    url: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  };
  hostname = 'https://digihappy.fi';

  const UAT_ENVIRONMENT = process.env.UAT_ENV;
  const uat = UAT_ENVIRONMENT === 'uat';
  if (uat) {
    hostname = 'https://uat.digihappy.fi';
  }
  // posti_url='https://api.unifaun.com/rs-extapi/v1'
} else {
  ormConfig = {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: DB_USERNAME || 'postgres',
    password: DB_PASSWORD,
    database: 'seniorHappyDB',
    synchronize: true,
    logging: false,
    entities: Entities
  };
}

export const posti_uri = posti_url;
export const server_uri = hostname;
export const stripe = require('stripe')(STRIPE_API_KEY);
export default ormConfig as ConnectionOptions;

if (!JWT_SECRET) {
  logger.error('No client secret. Set SESSION_SECRET or JWT_SECRET environment variable.');
}

if (!DB_PASSWORD) {
  logger.error('No postgres password. Set DB_PASSWORD environment variable.');
}

/* Application Constant */
export const MOBILE_ROUTER_PREFIX = '/mob';
export const MOBILE_ROUTER_VERSION = '/v1/api';

export const makeID = (length: number) => {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
