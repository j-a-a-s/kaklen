import {
  BadRequestException,
  INestApplication,
  ValidationPipe
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { ApiErrorFilter } from "../common/api-error.filter";
import { ERROR_CODES } from "../common/error-codes";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

describe("public lead capture security", () => {
  let app: INestApplication;
  let createLead: jest.Mock;

  beforeEach(async () => {
    createLead = jest.fn(async (dto: { privacyConsent: boolean }) => {
      if (!dto.privacyConsent) {
        throw new BadRequestException({
          code: ERROR_CODES.privacyConsentRequired,
          message: "Privacy policy consent is required"
        });
      }
      return {
        leadReference: "5d0786e8-591d-47a2-8854-e28e3452c4c7",
        whatsapp: { scheduled: false }
      };
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: 100 }]
        })
      ],
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: { create: createLead } },
        { provide: APP_GUARD, useClass: ThrottlerGuard }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    app.useGlobalFilters(new ApiErrorFilter());
    app.setGlobalPrefix("api");
    await app.listen(0, "127.0.0.1");
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts a valid payload without caching the response", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/leads")
      .send(validPayload())
      .expect(201);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.body).toEqual({
      success: true,
      leadReference: "5d0786e8-591d-47a2-8854-e28e3452c4c7",
      whatsapp: { scheduled: false }
    });
    expect(createLead).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["status overposting", { status: "QUALIFIED" }],
    ["non-empty honeypot", { website: "https://spam.example" }],
    ["HTML in a person name", { firstName: "<script>alert(1)</script>" }],
    ["mail control characters", { lastName: "Pérez\r\nBcc: attacker@example.com" }],
    ["hostile UTM metadata", { utmSource: "<img src=x onerror=alert(1)>" }],
    ["absolute landing page", { landingPage: "https://attacker.example/path" }],
    ["script referrer", { referrer: "javascript:alert(1)" }]
  ])("rejects %s before invoking the service", async (_scenario, hostileFields) => {
    const response = await request(app.getHttpServer())
      .post("/api/leads")
      .send({ ...validPayload(), ...hostileFields })
      .expect(400);

    expect(response.body.code).toBe(ERROR_CODES.badRequest);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("neutralizes prototype-pollution keys before invoking the service", async () => {
    const pollutionPayload = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'
    ) as Record<string, unknown>;
    const payload = JSON.stringify({
      ...validPayload(),
      ...pollutionPayload
    });

    const response = await request(app.getHttpServer())
      .post("/api/leads")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    const serviceDto = createLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(serviceDto, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(serviceDto, "constructor")).toBe(false);
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("returns a stable consent error without echoing submitted data", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/leads")
      .send(validPayload({ privacyConsent: false, message: "private marker 92ac" }))
      .expect(400);

    expect(response.body).toEqual({
      code: ERROR_CODES.privacyConsentRequired,
      message: "Privacy policy consent is required",
      statusCode: 400
    });
    expect(JSON.stringify(response.body)).not.toContain("private marker 92ac");
  });

  it("enforces five submissions per minute per client", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).post("/api/leads").send(validPayload())
      )
    );
    const limited = await request(app.getHttpServer())
      .post("/api/leads")
      .send(validPayload());

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe(ERROR_CODES.tooManyRequests);
    expect(createLead).toHaveBeenCalledTimes(5);
  });
});

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Ángela",
    lastName: "Pérez",
    email: "angela@example.com",
    phoneCountryCode: "CL",
    phone: "9 1234 5678",
    company: "Kaklen & Asociados",
    position: "Gerencia",
    country: "Chile",
    interestType: "KAKLEN",
    message: "Necesito conocer la plataforma.",
    privacyConsent: true,
    whatsappConsent: false,
    landingPage: "/contacto",
    referrer: "https://example.com/campaign",
    utmSource: "linkedin",
    ...overrides
  };
}
