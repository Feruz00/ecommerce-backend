const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');
const AppError = require('../utils/appError');

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next(new AppError('Please log in', 401));
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id);
    if (!user || user.status !== 'active') return next(new AppError('User not found or inactive', 401));
    req.user = user;
    next();
  } catch {
    next(new AppError('Invalid token', 401));
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden', 403));
  }
  next();
};

module.exports = { protect, restrictTo };
