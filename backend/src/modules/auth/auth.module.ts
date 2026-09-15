import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordHasherService } from "./password-hasher.service";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasherService,
    AccessTokenGuard,
    PlatformAdminGuard,
  ],
  exports: [AuthService, AccessTokenGuard, PlatformAdminGuard, JwtModule],
})
export class AuthModule {}
