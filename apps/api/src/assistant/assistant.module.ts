import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { UserActivationService } from "./user-activation.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [AssistantController],
  providers: [AssistantService, UserActivationService]
})
export class AssistantModule {}
