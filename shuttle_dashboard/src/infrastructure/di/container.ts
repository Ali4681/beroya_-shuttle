import { GetAppInfoUseCase } from "@/application/use-cases/get-app-info.use-case";
import { StaticAppInfoRepository } from "@/infrastructure/repositories/static-app-info.repository";

const appInfoRepository = new StaticAppInfoRepository();

export const container = {
  getAppInfoUseCase: new GetAppInfoUseCase(appInfoRepository),
} as const;
