// utils/getAdminFromToken.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const getAdminFromToken = async (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "King@2025");
  const user = await User.findById(decoded.userId);
  return user?.name || "Unknown Admin";
};
