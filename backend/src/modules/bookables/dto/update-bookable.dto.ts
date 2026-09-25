import { Transform, Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  BookableCapacityType,
  BookableStatus,
  ConfirmationPolicy,
  PricingType,
} from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { ReservationRuleDto } from "./reservation-rule.dto";

export class UpdateBookableDto {
  @ApiPropertyOptional({ example: "Updated Conference Room" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: "Updated room description." })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "updated-conference-room" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ enum: BookableStatus })
  @IsOptional()
  @IsEnum(BookableStatus)
  status?: BookableStatus;

  @ApiPropertyOptional({ enum: ConfirmationPolicy })
  @IsOptional()
  @IsEnum(ConfirmationPolicy)
  confirmationPolicy?: ConfirmationPolicy;

  @ApiPropertyOptional({ enum: BookableCapacityType })
  @IsOptional()
  @IsEnum(BookableCapacityType)
  capacityType?: BookableCapacityType;

  @ApiPropertyOptional({ enum: PricingType })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 2500, minimum: 1, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  price?: number | null;

  @ApiPropertyOptional({
    example: "NGN",
    pattern: "^[A-Z]{3}$",
    nullable: true,
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string | null;

  @ApiPropertyOptional({ type: ReservationRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReservationRuleDto)
  reservationRule?: ReservationRuleDto;
}
