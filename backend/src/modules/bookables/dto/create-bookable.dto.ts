import { Transform, Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
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
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { ReservationRuleDto } from "./reservation-rule.dto";

export class CreateBookableDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ example: "Main Conference Room" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: "A bright room for team meetings." })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "main-conference-room",
    description: "Generated from name when omitted",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ enum: BookableStatus, default: BookableStatus.DRAFT })
  @IsOptional()
  @IsEnum(BookableStatus)
  status?: BookableStatus;

  @ApiPropertyOptional({
    enum: ConfirmationPolicy,
    default: ConfirmationPolicy.AUTOMATIC,
  })
  @IsOptional()
  @IsEnum(ConfirmationPolicy)
  confirmationPolicy?: ConfirmationPolicy;

  @ApiProperty({ enum: PricingType })
  @IsEnum(PricingType)
  pricingType!: PricingType;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

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
