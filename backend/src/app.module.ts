import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule, HealthModule],
})
export class AppModule {}
