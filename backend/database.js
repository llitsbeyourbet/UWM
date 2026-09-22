const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",

    logging: (sql, timing) => {
      console.log(`[DB ${timing}ms] ${sql}`);
    },
    benchmark: true,

    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 60000,
    },

    dialectOptions: {
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    },
  }
);

module.exports = sequelize;