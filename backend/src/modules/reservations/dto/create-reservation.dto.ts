import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";

export class CreateReservationDto {
  @ApiProperty({ example: "2026-10-01T10:00:00.000Z" })
  @IsISO8601()
  @IsNotEmpty()
  startAt!: string;

  @ApiPropertyOptional({ example: "2026-10-01T11:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
