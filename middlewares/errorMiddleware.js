const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "An unexpected server error occurred.";
  let code = err.code || "SERVER_ERROR";
  let details;

  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message
    }));
    message = "Please correct the invalid information and try again.";
  } else if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_VALUE";
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `A record with this ${field} already exists. Please use a different value.`;
    details = { field };
  } else if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `The supplied ${err.path || "identifier"} is not valid.`;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Your authentication token is invalid. Please log in again.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Your session has expired. Please log in again.";
  } else if (err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    code = "FILE_UPLOAD_ERROR";
    message = err.code === "LIMIT_FILE_SIZE"
      ? "Images must be 200 KB or smaller; PDFs must be 1 MB or smaller."
      : `File upload failed: ${err.message}`;
  }

  if (process.env.NODE_ENV !== "production") {
    details = details || { stack: err.stack };
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: { code, ...(details ? { details } : {}) }
  });
};

export { notFound, errorHandler };
