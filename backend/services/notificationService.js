const jwt = require("jsonwebtoken");
const Notification = require("../models/Notification");
const User = require("../models/User");
const UserSession = require("../models/UserSession");

let io = null;
const userSockets = new Map();
const SESSION_IDLE_TIMEOUT = 3 * 60 * 1000;

const addSocket = (userId, socketId) => {
  const key = String(userId);
  if (!userSockets.has(key)) {
    userSockets.set(key, new Set());
  }
  userSockets.get(key).add(socketId);
};

const removeSocket = (userId, socketId) => {
  const key = String(userId);
  const sockets = userSockets.get(key);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(key);
  }
};

const emitToUser = (userId, event, payload) => {
  if (!io) return;

  const sockets = userSockets.get(String(userId));
  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("AUTH_REQUIRED"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id || !decoded.sessionId) {
      return next(new Error("INVALID_SESSION"));
    }

    const [user, session] = await Promise.all([
      User.findByPk(decoded.id),
      UserSession.findOne({
        where: {
          userId: decoded.id,
          sessionId: decoded.sessionId,
        },
      }),
    ]);

    if (!user || !session || session.revokedAt) {
      return next(new Error("INVALID_SESSION"));
    }

    const now = new Date();
    if (now >= new Date(session.expiresAt)) {
      await session.update({ revokedAt: now });
      return next(new Error("SESSION_EXPIRED"));
    }

    const lastSeen = new Date(session.lastSeenAt).getTime();
    if (now.getTime() - lastSeen > SESSION_IDLE_TIMEOUT) {
      await session.update({ revokedAt: now });
      return next(new Error("SESSION_IDLE_TIMEOUT"));
    }

    socket.userId = user.id;
    socket.sessionId = session.sessionId;
    return next();
  } catch (error) {
    return next(new Error("INVALID_TOKEN"));
  }
};

const init = (socketio) => {
  io = socketio;
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    addSocket(socket.userId, socket.id);
    console.log(`User ${socket.userId} connected socket ${socket.id}`);

    // ไม่รับ userId จาก client เพื่อป้องกันการปลอมตัวเป็นผู้ใช้อื่น
    socket.on("join", () => {});

    socket.on("disconnect", () => {
      removeSocket(socket.userId, socket.id);
      console.log(`User ${socket.userId} disconnected socket ${socket.id}`);
    });
  });
};

const createNotification = async (
  toUserId,
  type,
  activityId,
  activityName,
  fromUserId = null,
  fromUsername = null,
  options = {}
) => {
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
      adminNote: options.adminNote || null,
      isRead: false,
    });

    emitToUser(toUserId, "notification", {
      message: "คุณมีการแจ้งเตือนใหม่",
      notification: notif,
    });

    return notif;
  } catch (error) {
    console.error("Error in createNotification:", error);
    throw error;
  }
};

const emitCountUpdate = (userId) => {
  emitToUser(userId, "unreadCountUpdated");
};

module.exports = {
  init,
  createNotification,
  emitCountUpdate,
};
