import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { StorageModule } from "./common/storage/storage.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookablesModule } from "./modules/bookables/bookables.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { PublicBookingModule } from "./modules/public-booking/public-booking.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { PaymentAccountsModule } from "./modules/payment-accounts/payment-accounts.module";

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    OrganizationsModule,
    BookablesModule,
    AvailabilityModule,
    ReservationsModule,
    PublicBookingModule,
    PaymentsModule,
    PaymentAccountsModule,
    HealthModule,
  ],
})
export class AppModule {}
