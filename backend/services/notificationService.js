const Notification = require("../models/Notification");

let io = null;
const userSockets = new Map();

const init = (socketio) => {
  io = socketio;

  io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id);

    socket.on("join", (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} joined socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });
};

const createNotification = async (toUserId, type, activityId, activityName, fromUserId = null, fromUsername = null, options = {}) => {
  try {
    if (options.deduplicate) {
      const exists = await Notification.findOne({
        where: {
          type,
          activityId,
          toUserId,
          isRead: false,
        },
      });
      if (exists) return exists;
    }

    const notif = await Notification.create({
      toUserId,
      type,
      activityId,
      activityName,
      fromUserId,
      fromUsername,
      isRead: false,
    });

    const socketId = userSockets.get(toUserId);
    if (socketId && io) {
      io.to(socketId).emit("notification", {
        message: "คุณมีการแจ้งเตือนใหม่",
        notification: notif,
      });
    }

    return notif;
  } catch (error) {
    console.error("Error in createNotification:", error);
    throw error;
  }
};

module.exports = {
  init,
  createNotification,
};
