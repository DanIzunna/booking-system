import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PaymentAccountsController } from "./payment-accounts.controller";
import { PaymentAccountReadinessService } from "./payment-account-readiness.service";
import { PaymentAccountsService } from "./payment-accounts.service";
import { StripeConnectService } from "./stripe-connect.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [PaymentAccountsController],
  providers: [
    PaymentAccountsService,
    PaymentAccountReadinessService,
    StripeConnectService,
  ],
  exports: [PaymentAccountsService, PaymentAccountReadinessService],
})
export class PaymentAccountsModule {}
