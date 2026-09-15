import { ApiProperty } from "@nestjs/swagger";
import { AvailabilityExceptionType } from "@prisma/client";
import { IsEnum, IsISO8601 } from "class-validator";

export class CreateAvailabilityExceptionDto {
  @ApiProperty({ enum: AvailabilityExceptionType })
  @IsEnum(AvailabilityExceptionType)
  type!: AvailabilityExceptionType;

  @ApiProperty({ example: "2026-10-15T11:00:00.000Z" })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: "2026-10-15T13:00:00.000Z" })
  @IsISO8601()
  endAt!: string;
}
