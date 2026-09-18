import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db } from "../db/database";

const JWT_SECRET = process.env.JWT_SECRET || "auction_super_secret_jwt_key_hackathon_grade_2025";

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "HOST" | "BUYER";
  isAuthorizedHost: boolean;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Missing or invalid authorization token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Token is expired or invalid" });
    return;
  }

  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: Array<"ADMIN" | "HOST" | "BUYER">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: `Role ${req.user.role} is not authorized. Required: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

export function requireAuthorizedHost(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  if (req.user.role !== "ADMIN" && (req.user.role !== "HOST" || !req.user.isAuthorizedHost)) {
    res.status(403).json({
      success: false,
      code: "HOST_NOT_AUTHORIZED",
      message: "Host authorization required to publish auctions",
    });
    return;
  }

  next();
}
