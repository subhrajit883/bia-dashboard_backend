const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    const error = new Error("Please log in before accessing this resource.");
    error.statusCode = 401;
    return next(error);
  }

  if (!allowedRoles.includes(req.user.role)) {
    const error = new Error(`Access denied. This action is restricted to: ${allowedRoles.join(", ")}.`);
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    return next(error);
  }

  next();
};

export default authorize;
