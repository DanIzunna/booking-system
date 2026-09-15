import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookablesModule } from "./modules/bookables/bookables.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { AvailabilityModule } from "./modules/availability/availability.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    BookablesModule,
    AvailabilityModule,
    ReservationsModule,
    HealthModule,
  ],
})
export class AppModule {}
