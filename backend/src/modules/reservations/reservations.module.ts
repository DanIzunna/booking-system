import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AvailabilityModule } from "../availability/availability.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PaymentAccountsModule } from "../payment-accounts/payment-accounts.module";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AvailabilityModule,
    OrganizationsModule,
    PaymentAccountsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
