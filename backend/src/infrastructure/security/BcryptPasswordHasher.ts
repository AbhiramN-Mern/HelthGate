import bcrypt from "bcryptjs";
import { IPasswordHasher } from "../../core/security/IPasswordHasher.js";

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plain: string, saltRounds = 10): Promise<string> {
    return bcrypt.hash(plain, saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
