import knex, { Knex } from "knex";

const knexConfig = {
  debug: false,
  client: process.env.DB_CLIENT || "pg",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "prisma",
    password: process.env.DB_PASSWORD || "prisma",
    database: process.env.DB_DATABASE || "bpmn",
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./migrations",
  },
  // seeds: {
  //   directory: "./seeds",
  // },
};

export const db = knex(knexConfig);
