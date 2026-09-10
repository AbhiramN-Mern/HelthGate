import type { UserRole } from "../types/auth.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPasswordHasher } from "../core/security/IPasswordHasher.js";
import { ITokenService } from "../core/security/ITokenService.js";
import { RoleHandlerRegistry } from "../core/auth/handlers/RoleHandlerRegistry.js";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "../core/errors/AppError.js";

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
    private roleRegistry: RoleHandlerRegistry,
  ) {}

  async registerUser(data: {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    profile?: Record<string, unknown>;
  }) {
    const { name, email, password, role = "patient", profile = {} } = data;

    if (!name || !email || !password) {
      throw new BadRequestError("Name, email, and password are required");
    }

    if (!this.roleRegistry.hasRole(role)) {
      throw new BadRequestError("Role must be patient, doctor, or admin");
    }

    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("Email is already registered");
    }

    const roleHandler = this.roleRegistry.getHandler(role);
    roleHandler.validateRegistrationProfile(profile);

    const hashedPassword = await this.passwordHasher.hash(password);
    const user = await this.userRepo.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    try {
      await roleHandler.createProfile(user.id, profile);
    } catch (error) {
      await this.userRepo.findByIdAndDelete(user.id);
      throw error;
    }

    const token = this.tokenService.generateToken({ id: user.id, role });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async loginUser(data: { email?: string; password?: string }) {
    const { email, password } = data;

    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const user = await this.userRepo.findByEmail(email, true);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await this.passwordHasher.compare(password, (user as any).password);
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (this.roleRegistry.hasRole(user.role)) {
      const roleHandler = this.roleRegistry.getHandler(user.role as UserRole);
      await roleHandler.validateLoginStatus(user.id);
    }

    const token = this.tokenService.generateToken({ id: user.id, role: user.role as UserRole });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
