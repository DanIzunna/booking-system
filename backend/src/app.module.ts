import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
