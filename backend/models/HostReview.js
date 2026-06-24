const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const HostReview = sequelize.define("HostReview", {
  hostId: { type: DataTypes.INTEGER, allowNull: false },
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = HostReview;