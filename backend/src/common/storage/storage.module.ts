import { Global, Module } from "@nestjs/common";
import {
  ImageKitStorageProvider,
  readImageKitStorageConfig,
} from "./imagekit-storage.provider";

export const STORAGE_PROVIDER = "STORAGE_PROVIDER";

@Global()
@Module({
  providers: [
    {
      provide: ImageKitStorageProvider,
      useFactory: () =>
        new ImageKitStorageProvider(readImageKitStorageConfig()),
    },
    {
      provide: STORAGE_PROVIDER,
      useExisting: ImageKitStorageProvider,
    },
  ],
  exports: [ImageKitStorageProvider, STORAGE_PROVIDER],
})
export class StorageModule {}
