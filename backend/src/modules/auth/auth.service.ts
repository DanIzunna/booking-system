import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthResult, SafeUser } from "./auth.types";
import {
  createRefreshToken,
  getAccessTokenExpiresSeconds,
  getAccessTokenSecret,
  getRefreshTokenExpiresSeconds,
  hashRefreshToken,
} from "./token.utils";
import { PasswordHasherService } from "./password-hasher.service";

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type SafeUserRecord = Pick<User, "id" | "email" | "name" | "createdAt">;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();
    const passwordHash = await this.passwordHasher.hash(input.password);

    let user: SafeUserRecord;
    try {
      user = await this.prisma.user.create({
        data: { email, passwordHash, name },
        select: safeUserSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Email is already registered");
      }
      throw error;
    }

    return this.issueCredentials({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    });
  }

  async login(input: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });

    if (
      !user ||
      !(await this.passwordHasher.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueCredentials({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    });
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const now = new Date();
    const rotatedToken = createRefreshToken();
    const rotatedTokenHash = hashRefreshToken(rotatedToken);
    const expiresAt = new Date(
      now.getTime() + getRefreshTokenExpiresSeconds() * 1000,
    );

    let user: SafeUserRecord;
    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const session = await transaction.refreshSession.findFirst({
          where: { tokenHash },
          include: { user: { select: safeUserSelect } },
        });

        if (!session || session.revokedAt || session.expiresAt <= now) {
          throw new UnauthorizedException("Invalid refresh token");
        }

        await transaction.refreshSession.update({
          where: { id: session.id },
          data: { revokedAt: now },
        });

        await transaction.refreshSession.create({
          data: {
            userId: session.userId,
            tokenHash: rotatedTokenHash,
            expiresAt,
          },
        });

        return session.user;
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }

    return {
      accessToken: await this.createAccessToken(user.id),
      refreshToken: rotatedToken,
      user,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    return user;
  }

  private async issueCredentials(user: SafeUserRecord): Promise<AuthResult> {
    const refreshToken = createRefreshToken();
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(
          Date.now() + getRefreshTokenExpiresSeconds() * 1000,
        ),
      },
    });

    return {
      accessToken: await this.createAccessToken(user.id),
      refreshToken,
      user,
    };
  }

  private createAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId },
      {
        secret: getAccessTokenSecret(),
        expiresIn: getAccessTokenExpiresSeconds(),
      },
    );
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
