const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Activity = sequelize.define("Activity", {
  activityName: { type: DataTypes.STRING, allowNull: false },
  detail: { type: DataTypes.TEXT },
  date: { type: DataTypes.STRING },
  time: { type: DataTypes.STRING },
  endTime: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  participantCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  activityType: { type: DataTypes.ENUM("public", "private"), defaultValue: "public" },
  cover: { type: DataTypes.STRING, defaultValue: null },
  createdBy: { type: DataTypes.INTEGER },
  status: {type: DataTypes.ENUM("active", "suspended"),defaultValue: "active",},
  reportCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  category: {type: DataTypes.ENUM("ทั้งหมด","กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่"), defaultValue: "ทั้งหมด",},
  checkinStart: { type: DataTypes.STRING },  // เวลาที่เริ่มเช็คอินได้
  checkinEnd: { type: DataTypes.STRING },    // เวลาที่หมดเขตเช็คอิน
  commentPublic: {type: DataTypes.BOOLEAN, defaultValue: false, // default ปิดไว้ เห็นแค่เจ้าของ
}
});

module.exports = Activity;