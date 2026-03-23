import { DEFAULT_ENGAGEMENT_ID } from './constants';

export function sanitizeWorkspaceSegment(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const sanitized = withoutScheme
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  return sanitized;
}

export function buildWorkspacePath(
  primaryTarget?: string,
  engagementId: string = DEFAULT_ENGAGEMENT_ID,
): string {
  const targetSegment = sanitizeWorkspaceSegment(primaryTarget || '');
  return targetSegment ? `/workspace/${targetSegment}` : `/workspace/${engagementId}`;
}
