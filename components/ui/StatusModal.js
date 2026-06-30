import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react-native';
import Button from './Button';
import { colors, radius, shadows, spacing, typography } from '../../theme';

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    iconColor: colors.success,
    iconBackground: colors.successSoft,
    borderColor: colors.successSoft,
  },
  error: {
    icon: AlertTriangle,
    iconColor: colors.critical,
    iconBackground: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: colors.medium,
    iconBackground: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  info: {
    icon: Info,
    iconColor: colors.primary,
    iconBackground: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  loading: {
    icon: ActivityIndicator,
    iconColor: colors.primary,
    iconBackground: colors.surfaceAlt,
    borderColor: colors.border,
  },
};

export default function StatusModal({
  visible,
  type = 'info',
  title,
  message,
  primaryButton,
  secondaryButton,
  loading = false,
  onRequestClose,
}) {
  const config = STATUS_CONFIG[type] || STATUS_CONFIG.info;
  const isBusy = loading || Boolean(primaryButton?.loading);
  const handleRequestClose = onRequestClose || (() => {});

  const primaryAction = primaryButton || {};
  const secondaryAction = secondaryButton || null;

  const ModalIcon = config.icon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor: config.borderColor }]}>
          <View style={[styles.iconWrap, { backgroundColor: config.iconBackground }]}>
            {type === 'loading' ? (
              <ActivityIndicator color={config.iconColor} />
            ) : (
              <ModalIcon size={28} color={config.iconColor} strokeWidth={2.3} />
            )}
          </View>

          <Text style={styles.title}>{title || 'Status'}</Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {primaryAction.label ? (
              <Button
                label={primaryAction.label}
                onPress={primaryAction.onPress}
                variant={primaryAction.variant || 'primary'}
                loading={isBusy}
                disabled={primaryAction.disabled}
                style={[styles.actionButton, primaryAction.style]}
                textStyle={primaryAction.textStyle}
              />
            ) : null}

            {secondaryAction?.label ? (
              <Button
                label={secondaryAction.label}
                onPress={secondaryAction.onPress}
                variant={secondaryAction.variant || 'secondary'}
                disabled={secondaryAction.disabled || isBusy}
                style={[styles.actionButton, secondaryAction.style]}
                textStyle={secondaryAction.textStyle}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
    fontSize: 20,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actions: {
    width: '100%',
    marginTop: spacing.xl,
  },
  actionButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
});