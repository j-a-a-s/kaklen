import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedRequest } from "./auth.types";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "guard-access-secret-that-is-long-enough";
  });

  it("rejects missing and malformed bearer tokens before verification", async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      activePrisma() as unknown as ConstructorParameters<typeof JwtAuthGuard>[1]
    );

    await expect(guard.canActivate(createContext(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(createContext("Basic abc"))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(createContext("Bearer"))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("stores verified access token payload on the request", async () => {
    const payload = { sub: "user-1", email: "ada@example.com", sessionVersion: 0 };
    const request = createRequest("Bearer access-token");
    const jwtService = { verifyAsync: jest.fn(async () => payload) };
    const guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      activePrisma() as unknown as ConstructorParameters<typeof JwtAuthGuard>[1]
    );

    await expect(guard.canActivate(createContextFromRequest(request))).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith("access-token", {
      secret: "guard-access-secret-that-is-long-enough"
    });
    expect(request.user).toEqual(payload);
  });

  it("normalizes verification failures as unauthorized responses", async () => {
    const jwtService = {
      verifyAsync: jest.fn(async () => {
        throw new Error("jwt expired");
      })
    };
    const guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      activePrisma() as unknown as ConstructorParameters<typeof JwtAuthGuard>[1]
    );

    await expect(guard.canActivate(createContext("Bearer expired-token"))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects access tokens issued before the session version changed", async () => {
    const jwtService = {
      verifyAsync: jest.fn(async () => ({
        sub: "user-1",
        email: "ada@example.com",
        sessionVersion: 0
      }))
    };
    const prisma = { user: { findFirst: jest.fn(async () => ({ authVersion: 1 })) } };
    const guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      prisma as unknown as ConstructorParameters<typeof JwtAuthGuard>[1]
    );

    await expect(guard.canActivate(createContext("Bearer old-access-token"))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});

function activePrisma(): { user: { findFirst: jest.Mock } } {
  return { user: { findFirst: jest.fn(async () => ({ authVersion: 0 })) } };
}

function createContext(authorization: string | undefined): ExecutionContext {
  return createContextFromRequest(createRequest(authorization));
}

function createRequest(authorization: string | undefined): AuthenticatedRequest {
  return {
    headers: { authorization }
  } as AuthenticatedRequest;
}

function createContextFromRequest(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined
    }),
    getArgByIndex: () => undefined,
    getArgs: () => [request],
    getClass: () => JwtAuthGuard,
    getHandler: () => JwtAuthGuard,
    getType: () => "http",
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined
    }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined
    })
  } as unknown as ExecutionContext;
}
