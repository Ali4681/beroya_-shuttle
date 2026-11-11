import type { AppInfo } from "@/domain/entities/app-info";
import type { AppInfoRepository } from "@/domain/repositories/app-info.repository";

export class GetAppInfoUseCase {
  constructor(private readonly appInfoRepository: AppInfoRepository) {}

  async execute(): Promise<AppInfo> {
    return this.appInfoRepository.getAppInfo();
  }
}
