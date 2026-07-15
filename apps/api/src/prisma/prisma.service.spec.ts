import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("connects and disconnects during Nest lifecycle hooks", async () => {
    const service = new PrismaService();
    const connect = jest.spyOn(service, "$connect").mockResolvedValue(undefined);
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();
    await service.onApplicationShutdown();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
