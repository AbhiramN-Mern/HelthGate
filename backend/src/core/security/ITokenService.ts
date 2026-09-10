import { JwtPayload } from "../../types/auth.js";

export interface ITokenService {
  generateToken(payload: JwtPayload, expiresIn?: string): string;
  verifyToken(token: string): JwtPayload;
}
