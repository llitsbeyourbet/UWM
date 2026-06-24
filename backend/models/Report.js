const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Report = sequelize.define("Report", {
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM("pending", "reviewed"),
    defaultValue: "pending",
  },
});

module.exports = Report;