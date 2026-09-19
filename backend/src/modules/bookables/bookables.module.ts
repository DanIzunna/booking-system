import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PaymentAccountsModule } from "../payment-accounts/payment-accounts.module";
import { BookablesController } from "./bookables.controller";
import { BookablesService } from "./bookables.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    PaymentAccountsModule,
  ],
  controllers: [BookablesController],
  providers: [BookablesService],
})
export class BookablesModule {}
