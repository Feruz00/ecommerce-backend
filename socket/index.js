const { verifyToken } = require("../utils/jwt");
const { User } = require("../models");

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split(";")
          .find((c) => c.trim().startsWith("jwt="))
          ?.split("=")[1];
      if (!token) return next(new Error("Auth error"));
      const decoded = verifyToken(token);
      const user = await User.findByPk(decoded.id);
      if (!user || user.status !== "active")
        return next(new Error("Auth error"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Auth error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User joined ${socket.user.id}`);
    socket.join(`user_${socket.user.id}`);
    if (["admin", "manager"].includes(socket.user.role)) socket.join("admins");
    socket.on("disconnect", () => {});
  });
};
