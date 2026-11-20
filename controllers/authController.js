const { User } = require("../models");
const { createSendToken } = require("../utils/jwt");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.register = catchAsync(async (req, res, next) => {
  const { first_name, last_name, username, password, phone, preferred_lang } =
    req.body;
  if (!username || !password || !first_name || !last_name) {
    return next(
      new AppError(
        "first_name, last_name, username and password are required",
        400,
      ),
    );
  }
  if (await User.findOne({ where: { username } })) {
    return next(new AppError("username already used", 400));
  }
  const user = await User.create({
    first_name,
    last_name,
    username,
    password,
    phone,
    preferred_lang: preferred_lang || "en",
    role: "customer",
    status: "active",
  });
  createSendToken(user, 201, res, "Registered");
});

exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password)
    return next(new AppError("username and password required", 400));
  const user = await User.findOne({ where: { username } });
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid credentials", 401));
  }
  if (user.status !== "active")
    return next(new AppError("Account inactive", 401));
  user.last_login_at = new Date();
  await user.save({ fields: ["last_login_at"] });
  createSendToken(user, 200, res, "Logged in");
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    sameSite: "lax",
  });
  res.json({ status: "success" });
};

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ["password"] },
  });
  res.json({ status: "success", data: { user } });
});
