import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@ApiTags("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("reservations/:reservationId/initialize")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Initialize payment for an owned reservation" })
  @ApiParam({ name: "reservationId", format: "uuid" })
  initialize(
    @Req() request: AuthenticatedRequest,
    @Param("reservationId") reservationId: string,
  ) {
    return this.payments.initialize(request.user.id, reservationId);
  }

  @Post("webhooks/:provider")
  @ApiOperation({ summary: "Process a verified payment-provider webhook" })
  @ApiParam({ name: "provider", example: "fake" })
  webhook(
    @Param("provider") provider: string,
    @Body() payload: unknown,
    @Headers() headers: Record<string, unknown>,
  ) {
    return this.payments.processWebhook(provider, payload, headers);
  }
}
