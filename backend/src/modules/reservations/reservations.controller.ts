import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ListOrganizationReservationsDto } from "./dto/list-organization-reservations.dto";
import { ReservationsService } from "./reservations.service";

@Controller()
@UseGuards(AccessTokenGuard)
@ApiTags("reservations")
@ApiBearerAuth()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get("organizations/:organizationId/reservations")
  @ApiOperation({ summary: "List reservations for an organization member" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  listOrganization(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Query() query: ListOrganizationReservationsDto,
  ) {
    return this.reservations.listForOrganization(
      request.user.id,
      organizationId,
      query,
    );
  }

  @Get("organizations/:organizationId/reservations/:reservationId")
  @ApiOperation({ summary: "Get an organization reservation for a member" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "reservationId", format: "uuid" })
  getOrganizationReservation(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("reservationId") reservationId: string,
  ) {
    return this.reservations.getForOrganization(
      request.user.id,
      organizationId,
      reservationId,
    );
  }

  @Post("bookables/:bookableId/reservations")
  @ApiOperation({ summary: "Create a reservation for a published Bookable" })
  @ApiParam({ name: "bookableId", format: "uuid" })
  create(
    @Req() request: AuthenticatedRequest,
    @Param("bookableId") bookableId: string,
    @Body() input: CreateReservationDto,
  ) {
    return this.reservations.create(request.user.id, bookableId, input);
  }

  @Post("organizations/:organizationId/reservations/:reservationId/approve")
  @ApiOperation({ summary: "Approve a pending approval-required reservation" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "reservationId", format: "uuid" })
  approveOrganizationReservation(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("reservationId") reservationId: string,
  ) {
    return this.reservations.approveForOrganization(
      request.user.id,
      organizationId,
      reservationId,
    );
  }

  @Post("organizations/:organizationId/reservations/:reservationId/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject a pending approval-required reservation" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "reservationId", format: "uuid" })
  rejectOrganizationReservation(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Param("reservationId") reservationId: string,
  ) {
    return this.reservations.rejectForOrganization(
      request.user.id,
      organizationId,
      reservationId,
    );
  }

  @Post("reservations/:reservationId/confirm-free")
  @ApiOperation({
    summary: "Confirm an authenticated customer's free reservation",
  })
  @ApiParam({ name: "reservationId", format: "uuid" })
  confirmFree(
    @Req() request: AuthenticatedRequest,
    @Param("reservationId") reservationId: string,
  ) {
    return this.reservations.confirmFreeReservation(
      request.user.id,
      reservationId,
    );
  }

  @Get("reservations/:reservationId")
  @ApiOperation({ summary: "Get the authenticated customer's reservation" })
  @ApiParam({ name: "reservationId", format: "uuid" })
  get(
    @Req() request: AuthenticatedRequest,
    @Param("reservationId") reservationId: string,
  ) {
    return this.reservations.get(request.user.id, reservationId);
  }

  @Get("reservations")
  @ApiOperation({ summary: "List the authenticated customer's reservations" })
  list(@Req() request: AuthenticatedRequest) {
    return this.reservations.list(request.user.id);
  }
}
