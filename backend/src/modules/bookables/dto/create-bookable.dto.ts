import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookableStatus } from "@prisma/client";
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

  @ApiProperty({ example: "main-conference-room" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ enum: BookableStatus, default: BookableStatus.DRAFT })
  @IsOptional()
  @IsEnum(BookableStatus)
  status?: BookableStatus;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;
}
