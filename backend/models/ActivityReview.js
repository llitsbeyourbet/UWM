const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ActivityReview = sequelize.define("ActivityReview", {
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = ActivityReview;