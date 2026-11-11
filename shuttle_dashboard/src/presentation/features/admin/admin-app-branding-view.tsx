"use client";

import { DocumentUpload, Trash } from "iconsax-react-v2";
import { useQuery } from "@tanstack/react-query";
import { Lottie } from "lottie-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type {
  AppBrandingAdmin,
  AppBrandingConfig,
  AppBrandingInput,
  MobileAppKey,
  SplashAnimationType,
  UploadPurpose,
} from "@/domain/models/entities";
import { adminApi } from "@/infrastructure/api/admin.api";
import { qk } from "@/infrastructure/api/query-keys";
import { mediaUrl, uploadBrandingAsset } from "@/infrastructure/api/uploads";
import { ColorField } from "@/presentation/components/ui/color-field";
import { CheckboxField, Field, FormGrid, NumberInput, SelectInput } from "@/presentation/components/ui/form";
import { PageHeader } from "@/presentation/components/ui/page-header";
import { Card, PageSection, Tabs } from "@/presentation/components/ui/panel";
import { QueryBoundary } from "@/presentation/components/ui/states";
import { useApiMutation } from "@/presentation/hooks/use-api-mutation";
import { useErrorMessage } from "@/presentation/hooks/use-error-message";
import { toast } from "@/application/stores/toast-store";
import { cn } from "@/shared/lib/cn";

const APPS: MobileAppKey[] = ["passenger", "crew"];

function toInput(config: AppBrandingConfig): AppBrandingInput {
  return {
    logoUrl: config.logo,
    primaryColor: config.colors.primary,
    secondaryColor: config.colors.secondary,
    backgroundColor: config.colors.background,
    splash: {
      imageUrl: config.splash.image,
      animationUrl: config.splash.animation,
      animationType: config.splash.animationType,
      duration: config.splash.duration,
      enabled: config.splash.enabled,
    },
    animations: config.animations,
    appIcon: config.appIcon,
  };
}

function animationKind(url: string | null, declared?: SplashAnimationType): SplashAnimationType {
  if (declared && declared !== "none") return declared;
  if (!url) return "none";
  const lower = url.toLowerCase();
  if (lower.endsWith(".json")) return "lottie";
  if (lower.endsWith(".gif")) return "gif";
  return "image";
}

export function AdminAppBrandingView() {
  const t = useTranslations("AppBranding");
  const [app, setApp] = useState<MobileAppKey>("passenger");
  const query = useQuery({
    queryKey: qk.admin.appBranding(app),
    queryFn: () => adminApi.appBranding(app),
  });

  return (
    <PageSection>
      <PageHeader icon="branding" title={t("title")} subtitle={t("subtitle")} />
      <Tabs
        value={app}
        onChange={setApp}
        tabs={APPS.map((id) => ({ id, label: t(`apps.${id}`) }))}
      />
      <QueryBoundary query={query} loadingRows={8}>
        {(data) => <BrandingEditor key={`${data.app}-${data.updatedAt}`} data={data} />}
      </QueryBoundary>
    </PageSection>
  );
}

function BrandingEditor({ data }: { data: AppBrandingAdmin }) {
  const t = useTranslations("AppBranding");
  const tCommon = useTranslations("Common");
  const messageFor = useErrorMessage();
  const [config, setConfig] = useState<AppBrandingConfig>(data.draft);
  const [uploading, setUploading] = useState<string | null>(null);

  const save = useApiMutation({
    mutationFn: () => adminApi.saveAppBranding(data.app, toInput(config)),
    invalidate: [qk.admin.appBranding(data.app)],
    successMessage: t("draftSaved"),
  });
  const publish = useApiMutation({
    mutationFn: () => adminApi.publishAppBranding(data.app),
    invalidate: [qk.admin.appBranding(data.app)],
    successMessage: t("published"),
  });

  async function upload(purpose: Exclude<UploadPurpose, "student_photo">, file: File) {
    setUploading(purpose);
    try {
      const result = await uploadBrandingAsset(
        file,
        purpose,
        (contentType, byteSize, fileName) =>
          adminApi.presignAppBranding(data.app, purpose, contentType, byteSize, fileName),
        (objectKey) => adminApi.completeAppBranding(data.app, purpose, objectKey),
      );
      applyUpload(purpose, result.url, file);
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setUploading(null);
    }
  }

  function applyUpload(purpose: string, url: string, file: File) {
    const kind = animationKind(url, file.type === "image/gif" ? "gif" : file.type === "application/json" ? "lottie" : "image");
    setConfig((current) => {
      if (purpose === "logo") return { ...current, logo: url };
      if (purpose === "splash_image") {
        return { ...current, splash: { ...current.splash, image: url } };
      }
      if (purpose === "splash_animation") {
        return {
          ...current,
          splash: {
            ...current.splash,
            animation: url,
            animationType: kind === "none" ? "image" : kind,
            enabled: true,
          },
        };
      }
      const key =
        purpose === "loading_animation"
          ? "loading"
          : purpose === "home_animation"
            ? "home"
            : purpose === "success_animation"
              ? "success"
              : purpose === "error_animation"
                ? "error"
                : "empty";
      return { ...current, animations: { ...current.animations, [key]: url } };
    });
  }

  const busy = save.isPending || publish.isPending || uploading != null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <Card title={t("general")}>
          <FormGrid>
            <Field label={t("primaryColor")} required>
              <ColorField
                value={config.colors.primary}
                onChange={(value) => setConfig((c) => ({ ...c, colors: { ...c.colors, primary: value } }))}
              />
            </Field>
            <Field label={t("secondaryColor")} required>
              <ColorField
                value={config.colors.secondary}
                onChange={(value) => setConfig((c) => ({ ...c, colors: { ...c.colors, secondary: value } }))}
              />
            </Field>
            <Field label={t("backgroundColor")} required>
              <ColorField
                value={config.colors.background}
                onChange={(value) => setConfig((c) => ({ ...c, colors: { ...c.colors, background: value } }))}
              />
            </Field>
          </FormGrid>
          <AssetSlot
            label={t("logo")}
            hint={t("logoHint")}
            url={config.logo}
            uploading={uploading === "logo"}
            onUpload={(file) => void upload("logo", file)}
            onClear={() => setConfig((c) => ({ ...c, logo: null }))}
          />
        </Card>

        <Card title={t("splash")}>
          <FormGrid>
            <Field label={t("animationType")}>
              <SelectInput
                value={config.splash.animationType}
                onChange={(value) =>
                  setConfig((c) => ({
                    ...c,
                    splash: { ...c.splash, animationType: value as SplashAnimationType },
                  }))
                }
                options={[
                  { value: "none", label: t("types.none") },
                  { value: "image", label: t("types.image") },
                  { value: "gif", label: t("types.gif") },
                  { value: "lottie", label: t("types.lottie") },
                ]}
              />
            </Field>
            <Field label={t("duration")} hint={t("durationHint")}>
              <NumberInput
                value={String(config.splash.duration)}
                onChange={(value) =>
                  setConfig((c) => ({
                    ...c,
                    splash: { ...c.splash, duration: Number(value) || 2500 },
                  }))
                }
                min={500}
                max={15000}
                unit="ms"
              />
            </Field>
            <div className="sm:col-span-2">
              <CheckboxField
                checked={config.splash.enabled}
                onChange={(enabled) => setConfig((c) => ({ ...c, splash: { ...c.splash, enabled } }))}
                label={t("enableAnimation")}
                hint={t("enableAnimationHint")}
              />
            </div>
          </FormGrid>
          <div className="grid gap-4 md:grid-cols-2">
            <AssetSlot
              label={t("splashLogo")}
              hint={t("imageHint")}
              url={config.splash.image}
              uploading={uploading === "splash_image"}
              onUpload={(file) => void upload("splash_image", file)}
              onClear={() => setConfig((c) => ({ ...c, splash: { ...c.splash, image: null } }))}
            />
            <AssetSlot
              label={t("splashAnimation")}
              hint={t("animationHint")}
              url={config.splash.animation}
              kind={config.splash.animationType}
              uploading={uploading === "splash_animation"}
              accept="image/png,image/jpeg,image/webp,image/gif,application/json,.json"
              onUpload={(file) => void upload("splash_animation", file)}
              onClear={() =>
                setConfig((c) => ({
                  ...c,
                  splash: { ...c.splash, animation: null, animationType: "none", enabled: false },
                }))
              }
            />
          </div>
        </Card>

        <Card title={t("animations")}>
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["loading", "loading_animation"],
                ["home", "home_animation"],
                ["success", "success_animation"],
                ["error", "error_animation"],
                ["empty", "empty_animation"],
              ] as const
            ).map(([key, purpose]) => (
              <AssetSlot
                key={key}
                label={t(`slots.${key}`)}
                hint={t("animationHint")}
                url={config.animations[key]}
                uploading={uploading === purpose}
                accept="image/png,image/jpeg,image/webp,image/gif,application/json,.json"
                onUpload={(file) => void upload(purpose, file)}
                onClear={() => setConfig((c) => ({ ...c, animations: { ...c.animations, [key]: null } }))}
              />
            ))}
          </div>
        </Card>

        <Card title={t("appIcons")}>
          <p className="text-start text-xs text-text-muted">{t("appIconsHint")}</p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-5">
            {data.availableIcons.map((icon) => {
              const selected = config.appIcon.android === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, appIcon: { android: icon.id, ios: icon.id } }))}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition",
                    selected ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon.preview} alt={icon.name} className="size-14 rounded-xl" />
                  <span className="font-semibold">{icon.name}</span>
                  <span aria-hidden>{selected ? "●" : "○"}</span>
                </button>
              );
            })}
          </div>
          <p className="text-start text-sm text-text-primary">
            {t("currentIcon")}: <span className="font-semibold">{config.appIcon.android}</span>
          </p>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save.mutate()}>
            {save.isPending ? tCommon("saving") : t("saveDraft")}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => publish.mutate()}>
            {publish.isPending ? t("publishing") : t("publishChanges")}
          </button>
        </div>
      </div>

      <Card title={t("preview")} className="h-fit xl:sticky xl:top-4">
        <PhonePreview config={config} />
        <p className="text-start text-xs text-text-muted">
          {t("versionLabel")}: {data.version}
          {data.hasUnpublishedChanges ? ` · ${t("unpublished")}` : ""}
        </p>
      </Card>
    </div>
  );
}

function AssetSlot({
  label,
  hint,
  url,
  kind,
  uploading,
  accept = "image/png,image/jpeg,image/webp,image/gif",
  onUpload,
  onClear,
}: {
  label: string;
  hint?: string;
  url: string | null;
  kind?: SplashAnimationType;
  uploading?: boolean;
  accept?: string;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const t = useTranslations("AppBranding");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <label className="relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-muted text-text-muted">
        <AssetPreview url={url} kind={kind} fallback={t("uploadFile")} />
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-overlay">
            <span className="panel-spinner" />
          </span>
        ) : null}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
        />
      </label>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      {url ? (
        <button type="button" className="btn btn-danger btn-sm self-start" onClick={onClear}>
          <Trash size={14} color="currentColor" variant="Linear" />
          {t("removeFile")}
        </button>
      ) : null}
    </div>
  );
}

function AssetPreview({
  url,
  kind,
  fallback,
}: {
  url: string | null;
  kind?: SplashAnimationType;
  fallback: ReactNode;
}) {
  if (!url) {
    return (
      <span className="flex flex-col items-center gap-2 px-3 py-6">
        <DocumentUpload size={28} color="currentColor" variant="Linear" />
        <span className="text-center text-xs">{fallback}</span>
      </span>
    );
  }
  const type = animationKind(url, kind);
  const src = mediaUrl(url);
  if (type === "lottie") return <LottiePreview src={src} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="absolute inset-0 size-full object-contain" />
  );
}

function LottiePreview({ src }: { src: string }) {
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return <span className="px-3 text-center text-xs">Lottie</span>;
  }
  if (!data) return <span className="panel-spinner" />;
  return <CssLottieFallback data={data} />;
}

function CssLottieFallback({ data }: { data: object }) {
  return <Lottie src={data} loop autoplay className="h-full w-full" />;
}

function PhonePreview({ config }: { config: AppBrandingConfig }) {
  const t = useTranslations("AppBranding");
  const splashKind = animationKind(config.splash.animation, config.splash.animationType);
  const showMotion = config.splash.enabled && splashKind !== "none" && config.splash.animation;
  return (
    <div className="mx-auto w-[240px] overflow-hidden rounded-[28px] border border-border shadow-[var(--shadow-md)]">
      <div className="h-6 bg-black/80" />
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-5 py-8" style={{ background: config.colors.background }}>
        {config.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(config.logo)} alt="" className="h-16 w-16 rounded-2xl object-contain" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: config.colors.primary }}>
            B
          </span>
        )}
        {showMotion ? (
          <div className="relative h-28 w-full overflow-hidden rounded-xl">
            <AssetPreview url={config.splash.animation} kind={splashKind} fallback="" />
          </div>
        ) : config.splash.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(config.splash.image)} alt="" className="h-28 w-full rounded-xl object-contain" />
        ) : null}
        <p className="text-sm font-semibold" style={{ color: config.colors.primary }}>
          {t("welcome")}
        </p>
        <span className="h-2 w-24 rounded-full" style={{ background: config.colors.secondary }} />
      </div>
    </div>
  );
}
