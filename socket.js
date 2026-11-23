const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { User } = require("./models");

let io;

async function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.ADMIN_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Authenticate every socket connection.
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");

      // Adapt these names to your existing authentication setup.
      const token = socket.handshake.auth?.token || cookies.jwt || cookies.jwt;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findByPk(decoded.id);

      if (!user || user.status !== "active") {
        return next(new Error("Unauthorized"));
      }

      if (!["admin", "manager"].includes(user.role)) {
        return next(new Error("Admin access only"));
      }

      socket.user = {
        id: user.id,
        role: user.role,
      };

      next();
    } catch (error) {
      next(new Error("Invalid authentication"));
    }
  });

  io.on("connection", (socket) => {
    // Only authenticated admins/managers reach this point.
    socket.join("admins");

    console.log(
      `[admin socket] ${socket.user.role} connected: ${socket.user.id}`,
    );

    socket.on("disconnect", (reason) => {
      console.log(`[admin socket] disconnected: ${socket.user.id}`, reason);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }

  return io;
}

module.exports = {
  initializeSocket,
  getIO,
};
