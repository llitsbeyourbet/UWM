
require("dotenv").config();

const sequelize = require("../database");
const { DataTypes } = require("sequelize");

const TABLE_NAME = "ModerationTrainingJobs";

const COLUMNS = {
  heartbeatAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  leaseToken: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  leaseExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
};

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (!tables.includes(TABLE_NAME)) {
      throw new Error(
        `Table ${TABLE_NAME} does not exist.`
      );
    }

    const existingColumns =
      await queryInterface.describeTable(TABLE_NAME);

    for (const [columnName, definition] of Object.entries(COLUMNS)) {
      if (existingColumns[columnName]) {
        console.log(`SKIP: ${columnName} already exists`);
        continue;
      }

      await queryInterface.addColumn(
        TABLE_NAME,
        columnName,
        definition
      );

      console.log(`ADDED: ${columnName}`);
    }

    console.log("Training job migration completed");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
