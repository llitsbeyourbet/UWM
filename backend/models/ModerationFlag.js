const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ModerationFlag = sequelize.define("ModerationFlag", {
  contentType: {
    type: DataTypes.ENUM("activity", "review"),
    allowNull: false,
  },
  activityId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  commentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  field: {
    type: DataTypes.ENUM(
      "activityName",
      "detail",
      "activityComment",
      "hostComment"
    ),
    allowNull: false,
  },
  label: {
    type: DataTypes.ENUM("safe", "profanity", "insult", "sexual", "spam"),
    allowNull: false,
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  // ข้อความ ณ ตอนที่ AI ตรวจพบ เก็บไว้เป็นประวัติ
  flaggedText: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // ข้อความจากผู้ใช้แก้ไขแล้ว
  resolvedText: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  processingTimeMs: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  
  status: {
    type: DataTypes.ENUM(
      "pending",
      "reviewed",
      "actioned",
      "resolved"
    ),
    allowNull: false,
    defaultValue: "pending",
  },

  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = ModerationFlag;