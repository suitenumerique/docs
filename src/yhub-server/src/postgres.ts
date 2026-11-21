// @y/hub requires a URL even when postgres.js reads its settings from PG*.
export const postgresUrl = (): string => process.env.POSTGRES || 'postgres:///';
