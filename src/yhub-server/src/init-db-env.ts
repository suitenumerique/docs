import { postgresUrl } from './postgres.js';

process.env.POSTGRES = postgresUrl();
