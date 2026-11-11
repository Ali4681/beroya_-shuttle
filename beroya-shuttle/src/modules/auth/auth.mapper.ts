import {
  Institution,
  InstitutionBranch,
  InstitutionBranding,
  InstitutionSettings,
  SchoolStudent,
  ShuttleUser,
} from '../../generated/prisma/client';

export function mapUser(user: ShuttleUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    institutionId: user.institutionId,
    branchId: user.branchId,
    lastLoginAt: user.lastLoginAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
  };
}

export function mapStudent(student: SchoolStudent) {
  return {
    id: student.id,
    fullName: student.fullName,
    photoUrl: student.photoUrl,
    grade: student.grade,
    section: student.section,
    status: student.status,
    subscriptionType: student.subscriptionType,
    branchId: student.branchId,
  };
}

export function mapInstitution(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    displayName: institution.displayName,
    type: institution.type,
    operationModel: institution.operationModel,
    status: institution.status,
    city: institution.city,
  };
}

export function mapInstitutionProfile(institution: Institution) {
  return {
    ...mapInstitution(institution),
    contactPhone: institution.contactPhone,
    contactEmail: institution.contactEmail,
    address: institution.address,
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
  };
}

export function mapBranding(branding: InstitutionBranding | null) {
  if (!branding) {
    return null;
  }
  return {
    useInstitutionIdentity: branding.useInstitutionIdentity,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    welcomeMessage: branding.welcomeMessage,
    supportPhone: branding.supportPhone,
  };
}

export function mapSettings(settings: InstitutionSettings | null) {
  if (!settings) {
    return null;
  }
  return {
    timezone: settings.timezone,
    defaultDelayThresholdMinutes: settings.defaultDelayThresholdMinutes,
    defaultParentArrivalAlertMinutes: settings.defaultParentArrivalAlertMinutes,
    gpsStaleAfterSeconds: settings.gpsStaleAfterSeconds,
    locationPingIntervalSeconds: settings.locationPingIntervalSeconds,
  };
}

export function mapBranch(branch: InstitutionBranch) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    status: branch.status,
  };
}
