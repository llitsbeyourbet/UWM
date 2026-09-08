const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Activity = sequelize.define("Activity", {
  activityName: { type: DataTypes.STRING, allowNull: false },
  detail: { type: DataTypes.TEXT },
  date: { type: DataTypes.DATE },
  time: { type: DataTypes.TIME },
  endTime: { type: DataTypes.TIME },
  location: { type: DataTypes.STRING },
  participantCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  activityType: { type: DataTypes.ENUM("public", "private"), defaultValue: "public" },
  cover: { type: DataTypes.STRING, defaultValue: null },
  createdBy: { type: DataTypes.INTEGER },
  status: {type: DataTypes.ENUM("active", "suspended"),defaultValue: "active",},
  reportCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  category: {type: DataTypes.JSON, allowNull: false, defaultValue: [],},
  checkinStart: { type: DataTypes.TIME },  // เวลาที่เริ่มเช็คอินได้
  checkinEnd: { type: DataTypes.TIME },    // เวลาที่หมดเขตเช็คอิน
  commentPublic: {type: DataTypes.BOOLEAN, defaultValue: false, // default ปิดไว้ เห็นแค่เจ้าของ
}},{
  paranoid: true, // Enable soft deletes
  timestamps: true, // Enable timestamps (createdAt and updatedAt)
  deletedAt: "deletedAt",
});

module.exports = Activity;