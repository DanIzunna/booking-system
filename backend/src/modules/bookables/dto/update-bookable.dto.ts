import { Transform, Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { BookableStatus } from "@prisma/client";
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

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ type: ReservationRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReservationRuleDto)
  reservationRule?: ReservationRuleDto;
}
