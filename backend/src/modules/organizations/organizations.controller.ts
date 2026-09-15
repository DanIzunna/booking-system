import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AddMemberDto } from "./dto/add-member.dto";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(AccessTokenGuard)
@ApiTags("organizations")
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: "Create an organization" })
  @ApiResponse({ status: 201, description: "Creator becomes OWNER" })
  @ApiResponse({ status: 409, description: "Slug already exists" })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateOrganizationDto,
  ) {
    return this.organizations.create(request.user.id, input);
  }

  @Get()
  @ApiOperation({ summary: "List organizations for the authenticated user" })
  list(@Req() request: AuthenticatedRequest) {
    return this.organizations.list(request.user.id);
  }

  @Get(":organizationId")
  @ApiOperation({ summary: "Get an organization the user belongs to" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiResponse({ status: 404, description: "Organization is not accessible" })
  get(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
  ) {
    return this.organizations.get(request.user.id, organizationId);
  }

  @Patch(":organizationId")
  @ApiOperation({ summary: "Update an organization (OWNER only)" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiResponse({ status: 403, description: "OWNER membership required" })
  update(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Body() input: UpdateOrganizationDto,
  ) {
    return this.organizations.update(request.user.id, organizationId, input);
  }

  @Post(":organizationId/members")
  @ApiOperation({ summary: "Add a MEMBER (OWNER only)" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiResponse({ status: 403, description: "OWNER membership required" })
  @ApiResponse({ status: 409, description: "User is already a member" })
  addMember(
    @Req() request: AuthenticatedRequest,
    @Param("organizationId") organizationId: string,
    @Body() input: AddMemberDto,
  ) {
    return this.organizations.addMember(request.user.id, organizationId, input);
  }
}
