import jwt from "jsonwebtoken";

const generateToken = (userId, role, sessionId) =>
  jwt.sign({ id: userId, role, sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  });

export default generateToken;
