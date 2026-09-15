import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityEngineService } from "./availability-engine.service";
import { AvailabilityService } from "./availability.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService, AvailabilityEngineService],
})
export class AvailabilityModule {}
