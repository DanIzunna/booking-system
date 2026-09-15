import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule, HealthModule],
})
export class AppModule {}
