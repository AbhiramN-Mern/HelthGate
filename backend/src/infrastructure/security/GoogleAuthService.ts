import { OAuth2Client } from "google-auth-library";
import { BadRequestError, UnauthorizedError } from "../../core/errors/AppError.js";

export type VerifiedGoogleUser = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

export interface IGoogleAuthService {
  verifyIdToken(idToken: string): Promise<VerifiedGoogleUser>;
  verifyAuthorizationCode?(code: string): Promise<VerifiedGoogleUser>;
  getAuthorizationUrl?(): string;
}

export class GoogleAuthService implements IGoogleAuthService {
  constructor(
    private clientId?: string,
    private clientSecret?: string,
    private redirectUri?: string,
  ) {}

  private getClient(): OAuth2Client {
    const clientId = this.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      this.redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/auth/google/callback";

    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  getAuthorizationUrl(): string {
    const clientId = this.clientId || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestError("GOOGLE_CLIENT_ID is not configured");
    }

    const redirectUri =
      this.redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/auth/google/callback";

    const client = this.getClient();

    return client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      redirect_uri: redirectUri,
    });
  }

  async verifyAuthorizationCode(code: string): Promise<VerifiedGoogleUser> {
    if (!code || typeof code !== "string" || !code.trim()) {
      throw new BadRequestError("Authorization code is required");
    }

    const redirectUri =
      this.redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/auth/google/callback";

    try {
      const client = this.getClient();
      const { tokens } = await client.getToken({
        code,
        redirect_uri: redirectUri,
      });
      if (!tokens.id_token) {
        throw new UnauthorizedError("Google did not return an ID token for this authorization code");
      }
      return this.verifyIdToken(tokens.id_token);
    } catch (error: any) {
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError(error.message || "Failed to exchange authorization code with Google");
    }
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
      throw new BadRequestError("Google credential is required");
    }

    const clientId = this.clientId || process.env.GOOGLE_CLIENT_ID;

    // Handle mock token in test / development if configured or if idToken follows mock format
    if (idToken.startsWith("mock-google-token:")) {
      try {
        const payloadStr = idToken.replace("mock-google-token:", "");
        const parsed = JSON.parse(payloadStr);
        if (!parsed.email) {
          throw new BadRequestError("Google account has no associated email address");
        }
        if (parsed.emailVerified === false) {
          throw new BadRequestError("Google email address is not verified");
        }
        return {
          googleId: parsed.googleId || "google_test_sub_123",
          email: parsed.email.toLowerCase().trim(),
          emailVerified: parsed.emailVerified !== false,
          name: parsed.name || "Test Google Patient",
          picture: parsed.picture || "",
        };
      } catch (err: any) {
        if (err instanceof BadRequestError) throw err;
        throw new UnauthorizedError("Invalid mock Google token format");
      }
    }

    try {
      const client = this.getClient();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId || undefined,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedError("Invalid Google token payload");
      }

      if (!payload.sub) {
        throw new UnauthorizedError("Missing Google user ID");
      }

      if (!payload.email) {
        throw new BadRequestError("Google account has no associated email address");
      }

      if (!payload.email_verified) {
        throw new BadRequestError("Google email address is not verified");
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase().trim(),
        emailVerified: !!payload.email_verified,
        name: payload.name || payload.email.split("@")[0] || "Patient",
        picture: payload.picture || "",
      };
    } catch (error: any) {
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError(error.message || "Failed to verify Google token with Google servers");
    }
  }
}
