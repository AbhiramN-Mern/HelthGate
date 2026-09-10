import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { JwtPayload } from "../../types/auth.js";
import { ITokenService } from "../../core/security/ITokenService.js";

export class JwtTokenService implements ITokenService {
  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in the environment");
    }
    return secret;
  }

  generateToken(payload: JwtPayload, expiresIn = process.env.JWT_EXPIRES_IN || "7d"): string {
    return jwt.sign(payload, this.getSecret(), {
      expiresIn: expiresIn as SignOptions["expiresIn"],
    });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.getSecret()) as JwtPayload;
  }
}
