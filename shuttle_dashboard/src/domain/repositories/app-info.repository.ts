import type { AppInfo } from "@/domain/entities/app-info";

export interface AppInfoRepository {
  getAppInfo(): Promise<AppInfo>;
}
