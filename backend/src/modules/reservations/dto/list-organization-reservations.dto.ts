import { ApiPropertyOptional } from "@nestjs/swagger";
import { ReservationStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from "class-validator";

export class ListOrganizationReservationsDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  bookableId?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ example: "2026-09-17" })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
