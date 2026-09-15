import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrganizationAuthorizationService } from "./organization-authorization.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationAuthorizationService, OrganizationsService],
  exports: [OrganizationAuthorizationService, OrganizationsService],
})
export class OrganizationsModule {}
