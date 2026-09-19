import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PaymentAccountsService } from "./payment-accounts.service";
import { StripeConnectService } from "./stripe-connect.service";

@Controller("organizations/:organizationId/payment-account")
@UseGuards(AccessTokenGuard)
@ApiTags("organization-payment-account")
@ApiBearerAuth()
export class PaymentAccountsController {
  constructor(
    private readonly accounts: PaymentAccountsService,
    private readonly stripe: StripeConnectService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get an organization's payment account" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  get(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Res() response: Response,
  ) {
    return this.accounts
      .getForMember(request.user.id, organizationId)
      .then((account) => response.status(HttpStatus.OK).json(account));
  }

  @Post("connect")
  @ApiOperation({ summary: "Start Stripe Connect onboarding" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  connect(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
  ) {
    return this.stripe.connect(request.user.id, organizationId);
  }

  @Post("sync")
  @ApiOperation({ summary: "Synchronize the organization's Stripe account" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  sync(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
  ) {
    return this.stripe.sync(request.user.id, organizationId);
  }

  @Post("disconnect")
  @ApiOperation({
    summary: "Mark the organization's payment account disconnected",
  })
  @ApiParam({ name: "organizationId", format: "uuid" })
  disconnect(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
  ) {
    return this.accounts.disconnect(request.user.id, organizationId);
  }
}
