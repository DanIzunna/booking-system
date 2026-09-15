import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InitializePaymentResponseDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  paymentId!: string | null;

  @ApiProperty({ example: "PENDING" })
  status!: string;

  @ApiProperty({ example: 1000000 })
  amount!: number;

  @ApiProperty({ example: "NGN" })
  currency!: string;

  @ApiPropertyOptional({
    example: "https://fake-payments.local/checkout/fake_123",
  })
  checkoutUrl?: string;

  @ApiPropertyOptional({ example: "fake_123" })
  providerReference?: string;

  @ApiPropertyOptional({ example: "CONFIRMED" })
  reservationStatus?: string;
}
