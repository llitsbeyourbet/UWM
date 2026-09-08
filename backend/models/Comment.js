const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Comment = sequelize.define("Comment", {
  activityId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: false },
  commentType: { type: DataTypes.ENUM("activity", "host"), allowNull: false, defaultValue: "activity",},
  isPublic: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true,
},
});

module.exports = Comment;