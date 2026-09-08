const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Report = sequelize.define("Report", {
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: false },
  detail: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM("pending", "reviewing", "resolved", "rejected"),
    defaultValue: "pending",
  },
  decision: { type: DataTypes.STRING, allowNull: true, },
  adminNote: { type: DataTypes.TEXT, allowNull: true, },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true,},
  reviewedAt: { type: DataTypes.DATE, allowNull: true,},
});

module.exports = Report;