export const colors = {
  background: '#F8F8F6',
  card: '#FFFFFF',
  primary: '#FF6B35',
  primaryDark: '#D94F1F',
  critical: '#FF4D4D',
  high: '#FF6B35',
  medium: '#FFB800',
  low: '#22C55E',
  success: '#22C55E',
  text: '#111111',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  dangerSoft: '#FEF2F2',
  warningSoft: '#FFFBEB',
  successSoft: '#F0FDF4',
  primarySoft: '#FFF1EA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  section: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
};

export const shadows = {
  card: {
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
};

export const statusTokens = {
  pending: { label: 'Pending', color: colors.medium, background: colors.warningSoft },
  accepted: { label: 'Volunteer Assigned', color: colors.primary, background: colors.primarySoft },
  resolved: { label: 'Resolved', color: colors.success, background: colors.successSoft },
  fake: { label: 'Fake', color: colors.critical, background: colors.dangerSoft },
};

export const severityTokens = {
  low: { label: 'Low', color: colors.low, background: colors.successSoft },
  medium: { label: 'Medium', color: colors.medium, background: colors.warningSoft },
  high: { label: 'High', color: colors.high, background: colors.primarySoft },
  critical: { label: 'Critical', color: colors.critical, background: colors.dangerSoft },
};

export function getStatusToken(status) {
  return statusTokens[(status || 'pending').toLowerCase()] || statusTokens.pending;
}

export function getSeverityToken(severity) {
  return severityTokens[(severity || 'medium').toLowerCase()] || severityTokens.medium;
}
