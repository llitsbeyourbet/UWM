
const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ModerationTrainingJob = sequelize.define("ModerationTrainingJob", {
  status: {
    type: DataTypes.ENUM(
      "pending",
      "preparing",
      "training",
      "evaluating",
      "completed",
      "failed"
    ),
    allowNull: false,
    defaultValue: "pending",
  },

  modelVersion: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },

  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  finishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // เวลาล่าสุดที่ Worker ยืนยันว่ากำลังทำงาน
  heartbeatAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // จำนวนครั้งที่ Job ถูกนำกลับมาทำใหม่
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
}, {
  timestamps: true,
});

module.exports = ModerationTrainingJob;
