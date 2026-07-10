import { Module } from "@nestjs/common";
import { readApiConfig } from "@kaklen/config";
import { LocalStorageService } from "./local-storage.service";
import { S3StorageService } from "./s3-storage.service";
import { STORAGE_SERVICE } from "./storage.types";

@Module({
  providers: [
    LocalStorageService,
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (local: LocalStorageService, s3: S3StorageService) => {
        const config = readApiConfig(process.env);
        return config.nodeEnv === "production" ? s3 : local;
      },
      inject: [LocalStorageService, S3StorageService]
    }
  ],
  exports: [STORAGE_SERVICE]
})
export class StorageModule {}
