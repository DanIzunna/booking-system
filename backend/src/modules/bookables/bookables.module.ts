import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { StorageModule } from "../../common/storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PaymentAccountsModule } from "../payment-accounts/payment-accounts.module";
import { BookablesController } from "./bookables.controller";
import { BookablesService } from "./bookables.service";
import { BookableImagesController } from "./images/bookable-images.controller";
import { BookableImagesService } from "./images/bookable-images.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    PaymentAccountsModule,
    StorageModule,
  ],
  controllers: [BookablesController, BookableImagesController],
  providers: [BookablesService, BookableImagesService],
})
export class BookablesModule {}
