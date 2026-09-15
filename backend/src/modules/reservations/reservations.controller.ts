import {
  Body,
  Controller,
  Get,
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
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ReservationsService } from "./reservations.service";

@Controller()
@UseGuards(AccessTokenGuard)
@ApiTags("reservations")
@ApiBearerAuth()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

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
