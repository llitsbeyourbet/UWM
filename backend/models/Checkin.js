const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const CheckIn = sequelize.define(
  "CheckIn",
  {
    activityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    checkedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["activityId", "userId"],
      },
    ],
  }
);

module.exports = CheckIn;