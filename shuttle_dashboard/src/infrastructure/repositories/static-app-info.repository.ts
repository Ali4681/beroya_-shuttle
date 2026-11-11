import type { AppInfo } from "@/domain/entities/app-info";
import type { AppInfoRepository } from "@/domain/repositories/app-info.repository";

export class StaticAppInfoRepository implements AppInfoRepository {
  async getAppInfo(): Promise<AppInfo> {
    return {
      name: "Beroya on plus",
      version: "0.1.0",
      architecture: "Clean Architecture",
    };
  }
}
