import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { AuthenticatedRequest } from "../auth.types";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException("Authentication required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (user.platformRole !== PlatformRole.ADMIN) {
      throw new ForbiddenException("Platform administrator access required");
    }

    return true;
  }
}
