import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AvailabilityWindowType } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateAvailabilityWindowDto {
  @ApiProperty({ enum: AvailabilityWindowType })
  @IsEnum(AvailabilityWindowType)
  type!: AvailabilityWindowType;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: "0 = Sunday" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @ApiPropertyOptional({ example: "09:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  startTime?: string;

  @ApiPropertyOptional({ example: "17:00" })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
  endTime?: string;

  @ApiPropertyOptional({ example: "2026-10-15T08:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({ example: "2026-10-15T12:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  endAt?: string;
}
