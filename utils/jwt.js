const jwt = require("jsonwebtoken");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "dev-secret-change-me", {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");

const createSendToken = (user, statusCode, res, message = "OK") => {
  const token = signToken(user.id);
  const days = parseInt(process.env.JWT_COOKIE_EXPIRES_DAYS || "7", 10);
  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    // sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
  };
  res.cookie("jwt", token, cookieOptions);
  const u = user.toJSON ? user.toJSON() : { ...user };
  delete u.password;
  res.status(statusCode).json({
    status: "success",
    message,
    token,
    data: { user: u },
  });
};

module.exports = { signToken, verifyToken, createSendToken };
