import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DurationMode } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateIf,
} from "class-validator";

export class ReservationRuleDto {
  @ApiProperty({ enum: DurationMode, example: DurationMode.FIXED })
  @IsEnum(DurationMode)
  durationMode!: DurationMode;

  @ApiPropertyOptional({
    example: 3600,
    description: "Fixed duration in seconds",
  })
  @ValidateIf(
    (input: ReservationRuleDto) => input.durationMode === DurationMode.FIXED,
  )
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  fixedDuration?: number;

  @ApiPropertyOptional({
    example: 1800,
    description: "Flexible minimum duration in seconds",
  })
  @ValidateIf(
    (input: ReservationRuleDto) => input.durationMode === DurationMode.FLEXIBLE,
  )
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  minimumDuration?: number;

  @ApiPropertyOptional({
    example: 7200,
    description: "Flexible maximum duration in seconds",
  })
  @ValidateIf(
    (input: ReservationRuleDto) => input.durationMode === DurationMode.FLEXIBLE,
  )
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  maximumDuration?: number;

  @ApiPropertyOptional({ example: 3600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  minimumAdvanceTime?: number;

  @ApiPropertyOptional({ example: 2592000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maximumAdvanceTime?: number;

  @ApiPropertyOptional({ example: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cancellationDeadline?: number;
}
