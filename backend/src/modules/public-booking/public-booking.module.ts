import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AvailabilityModule } from "../availability/availability.module";
import { PublicBookingController } from "./public-booking.controller";
import { PublicBookingService } from "./public-booking.service";

@Module({
  imports: [PrismaModule, AvailabilityModule],
  controllers: [PublicBookingController],
  providers: [PublicBookingService],
})
export class PublicBookingModule {}
