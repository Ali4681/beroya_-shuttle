import type { AppLocale } from '../../common/i18n';
import { getRequestContext } from '../../common/request-context/request-context';
import {
  NotificationRecipient,
  ShuttleNotification,
  ShuttleRole,
} from '../../generated/prisma/client';
import { noticeForLocale } from '../admin/platform-settings';

type RecipientUser = {
  id: string;
  fullName: string;
  phone: string;
  role: ShuttleRole;
};

export function mapNotification(
  row: ShuttleNotification & {
    recipients?: (NotificationRecipient & { user?: RecipientUser })[];
  },
) {
  return {
    id: row.id,
    institutionId: row.institutionId,
    branchId: row.branchId,
    routeId: row.routeId,
    audience: row.audience,
    origin: row.origin,
    title: row.title,
    body: row.body,
    data: row.data,
    recipientsCount: row.recipientsCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt,
    recipients: row.recipients?.map((recipient) => ({
      id: recipient.id,
      userId: recipient.userId,
      status: recipient.status,
      sentAt: recipient.sentAt,
      user: recipient.user
        ? {
            id: recipient.user.id,
            fullName: recipient.user.fullName,
            phone: recipient.user.phone,
            role: recipient.user.role,
          }
        : null,
    })),
  };
}

export function mapInboxItem(
  recipient: NotificationRecipient & { notification: ShuttleNotification },
  locale?: AppLocale | string | null,
) {
  const lang = locale ?? getRequestContext()?.locale ?? 'ar';
  const copy = noticeForLocale(
    recipient.notification.title,
    recipient.notification.body,
    recipient.notification.data,
    lang,
  );
  return {
    id: recipient.id,
    status: recipient.status,
    sentAt: recipient.sentAt,
    readAt: recipient.readAt,
    createdAt: recipient.createdAt,
    notification: {
      id: recipient.notification.id,
      title: copy.title,
      body: copy.body,
      origin: recipient.notification.origin,
      audience: recipient.notification.audience,
      data: recipient.notification.data,
      createdAt: recipient.notification.createdAt,
    },
  };
}
