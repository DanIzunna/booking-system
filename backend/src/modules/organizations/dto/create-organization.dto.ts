import {
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CreateOrganizationDto {
  @ApiProperty({ example: "Lagos Studio" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "lagos-studio" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ example: "Africa/Lagos", default: "Africa/Lagos" })
  @IsString()
  @IsTimeZone()
  timezone!: string;
}
