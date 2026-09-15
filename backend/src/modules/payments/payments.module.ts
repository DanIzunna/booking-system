import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ReservationsModule } from "../reservations/reservations.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { FakePaymentProvider } from "./providers/fake-payment-provider";

@Module({
  imports: [PrismaModule, AuthModule, ReservationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FakePaymentProvider],
})
export class PaymentsModule {}
