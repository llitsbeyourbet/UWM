const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ModerationFlag = sequelize.define("ModerationFlag", {
  contentType: {type: DataTypes.ENUM("activity", "review"),allowNull: false,},
  activityId: {type: DataTypes.INTEGER,allowNull: false,},
  commentId: {type: DataTypes.INTEGER,allowNull: true,},
  userId: {type: DataTypes.INTEGER,allowNull: false,},
  field: {type: DataTypes.ENUM("activityName","detail","activityComment","hostComment"),allowNull: false,},
  label: {type: DataTypes.ENUM("profanity","insult","sexual","spam"),allowNull: false,},
  confidence: {type: DataTypes.FLOAT,allowNull: false,},
  status: {type: DataTypes.ENUM("pending","reviewed","actioned"),
    allowNull: false,
    defaultValue: "pending",
  },
  reviewedBy: {type: DataTypes.INTEGER,allowNull: true,},
  reviewedAt: {type: DataTypes.DATE,allowNull: true,},
}, {
  timestamps: true,
});
module.exports = ModerationFlag;