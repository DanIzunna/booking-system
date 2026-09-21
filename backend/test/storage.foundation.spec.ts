import { Test } from "@nestjs/testing";
import { ImageKitStorageProvider, readImageKitStorageConfig } from "../src/common/storage/imagekit-storage.provider";
import { STORAGE_PROVIDER, StorageModule } from "../src/common/storage/storage.module";
import { StorageVerificationError } from "../src/common/storage/storage.types";

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

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "preserves supported %s upload metadata",
    async (mimeType) => {
      const provider = new ImageKitStorageProvider({
        publicKey: "public-key",
        privateKey: "private-key",
        urlEndpoint: "https://ik.example/account",
      });
      (provider as any).client = {
        files: {
          upload: jest.fn().mockResolvedValue({
            fileId: "provider-file-id",
            filePath: "/organizations/org/bookables/bookable/photo",
            name: "photo",
            size: 4,
            width: 100,
            height: 80,
          }),
        },
      };

      const result = await provider.upload({
        buffer: Buffer.from("data"),
        fileName: "photo",
        mimeType,
        folder: "organizations/org/bookables/bookable",
      });

      expect(result.mimeType).toBe(mimeType);
      expect(result.fileSizeBytes).toBe(4);
    },
  );

  it("rejects empty server-side uploads", async () => {
    const provider = new ImageKitStorageProvider({
      publicKey: "public-key",
      privateKey: "private-key",
      urlEndpoint: "https://ik.example/account",
    });

    await expect(provider.upload({
      buffer: Buffer.alloc(0),
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    })).rejects.toThrow("cannot be empty");
  });

  it("rejects server-side uploads over 5 MB", async () => {
    const provider = new ImageKitStorageProvider({
      publicKey: "public-key",
      privateKey: "private-key",
      urlEndpoint: "https://ik.example/account",
    });

    await expect(provider.upload({
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    })).rejects.toThrow("5 MB");
  });

  it("rejects unsupported server-side MIME types", async () => {
    const provider = new ImageKitStorageProvider({
      publicKey: "public-key",
      privateKey: "private-key",
      urlEndpoint: "https://ik.example/account",
    });

    await expect(provider.upload({
      buffer: Buffer.from("data"),
      fileName: "document.pdf",
      mimeType: "application/pdf",
    })).rejects.toThrow("Unsupported image MIME type");
  });

  it("uses the ImageKit SDK authentication helper for browser uploads", async () => {
    const provider = new ImageKitStorageProvider({
      publicKey: "public-key",
      privateKey: "private-key",
      urlEndpoint: "https://ik.example/account",
    });
    const getAuthenticationParameters = jest.fn().mockReturnValue({
      token: "token",
      expire: 123,
      signature: "signature",
    });
    (provider as any).client = { helper: { getAuthenticationParameters } };

    const result = await provider.authorizeUpload({
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      folder: "organizations/org/bookables/bookable",
    });

    expect(getAuthenticationParameters).toHaveBeenCalledWith();
    expect(result).not.toHaveProperty("privateKey");
  });

  it("rejects a verified asset URL outside the configured ImageKit endpoint", async () => {
    const provider = new ImageKitStorageProvider({
      publicKey: "public-key",
      privateKey: "private-key",
      urlEndpoint: "https://ik.example/account/",
    });
    (provider as any).client = {
      files: {
        get: jest.fn().mockResolvedValue({
          fileId: "provider-file-id",
          filePath: "/organizations/org/bookables/bookable/photo.jpg",
          url: "https://attacker.example/photo.jpg",
          mime: "image/jpeg",
          size: 4,
          width: 100,
          height: 80,
        }),
      },
    };

    await expect(provider.verifyUpload({
      providerId: "provider-file-id",
      expectedPrefix: "organizations/org/bookables/bookable",
    })).rejects.toBeInstanceOf(StorageVerificationError);
  });
});
