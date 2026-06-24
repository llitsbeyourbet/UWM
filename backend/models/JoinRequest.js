const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const JoinRequest = sequelize.define("JoinRequest", {
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled", "checked_in"),
    defaultValue: "pending",
  },
});

module.exports = JoinRequest;