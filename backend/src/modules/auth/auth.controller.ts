import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { AuthenticatedRequest } from "./auth.types";
import {
  DEFAULT_REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from "./auth.constants";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(input);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(input);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[this.cookieName()];
    if (!refreshToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.cookies?.[this.cookieName()]);
    response.clearCookie(this.cookieName(), this.cookieOptions());
    return { success: true };
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.id);
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(this.cookieName(), token, this.cookieOptions());
  }

  private cookieName(): string {
    return process.env.AUTH_REFRESH_COOKIE_NAME || DEFAULT_REFRESH_COOKIE_NAME;
  }

  private cookieOptions() {
    const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
    const sameSite = ["strict", "lax", "none"].includes(
      configuredSameSite || "",
    )
      ? (configuredSameSite as "strict" | "lax" | "none")
      : "lax";

    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite,
      path: REFRESH_COOKIE_PATH,
    } as const;
  }
}
