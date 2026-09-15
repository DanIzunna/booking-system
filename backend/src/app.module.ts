import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookablesModule } from "./modules/bookables/bookables.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    BookablesModule,
    HealthModule,
  ],
})
export class AppModule {}
