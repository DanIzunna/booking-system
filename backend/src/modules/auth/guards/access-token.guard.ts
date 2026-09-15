import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedRequest } from "../auth.types";
import { getAccessTokenSecret } from "../token.utils";

interface AccessTokenPayload {
  sub?: string;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: getAccessTokenSecret(),
        },
      );

      if (!payload.sub) {
        throw new UnauthorizedException("Authentication required");
      }

      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException("Authentication required");
    }
  }
}
