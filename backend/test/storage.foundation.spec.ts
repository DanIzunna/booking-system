import { Test } from "@nestjs/testing";
import { ImageKitStorageProvider, readImageKitStorageConfig } from "../src/common/storage/imagekit-storage.provider";
import { STORAGE_PROVIDER, StorageModule } from "../src/common/storage/storage.module";

describe("Storage foundation", () => {
  it("handles configuration without requiring live ImageKit credentials", () => {
    const config = readImageKitStorageConfig({});

    expect(config.publicKey).toBeUndefined();
    expect(config.privateKey).toBeUndefined();
    expect(config.urlEndpoint).toBeUndefined();

    const provider = new ImageKitStorageProvider(config);
    expect(provider.isConfigured()).toBe(false);
  });

  it("resolves the storage provider through NestJS DI", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    const provider = moduleRef.get(STORAGE_PROVIDER);
    expect(provider).toBeInstanceOf(ImageKitStorageProvider);
  });
});
