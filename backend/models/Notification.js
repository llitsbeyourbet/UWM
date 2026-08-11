const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Notification = sequelize.define("Notification", {
  type: {
    type: DataTypes.ENUM("join_request", "join_confirmed", "join_rejected", "member_joined", "reminder", "report","review_request", "checkin", "review", "activity_warning", "activity_suspended",),
    allowNull: false,
  },
  fromUserId: { type: DataTypes.INTEGER },
  toUserId: { type: DataTypes.INTEGER, allowNull: false },
  activityId: { type: DataTypes.INTEGER },
  activityName: { type: DataTypes.STRING },
  fromUsername: { type: DataTypes.STRING },
  adminNote: {type: DataTypes.TEXT, allowNull: true},
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
});


module.exports = Notification;