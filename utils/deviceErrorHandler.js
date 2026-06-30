const DEVICE_ERROR_TYPES = {
  LOCATION_SERVICES_DISABLED: 'location_services_disabled',
  LOCATION_PERMISSION_DENIED: 'location_permission_denied',
  CAMERA_PERMISSION_DENIED: 'camera_permission_denied',
  GALLERY_PERMISSION_DENIED: 'gallery_permission_denied',
  IMAGE_PICKER_CANCELLED: 'image_picker_cancelled',
  GPS_UNAVAILABLE: 'gps_unavailable',
  UNKNOWN: 'unknown_device_error',
};

const DEFAULT_PRIMARY_ACTION = {
  label: 'OK',
  variant: 'primary',
};

function toLowerSafe(value) {
  return String(value || '').trim().toLowerCase();
}

function containsAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function isCancelledError(error) {
  if (!error) return false;

  return Boolean(
    error.canceled ||
    error.cancelled ||
    containsAny(toLowerSafe(error.code), ['cancel']) ||
    containsAny(toLowerSafe(error.name), ['cancel']) ||
    containsAny(toLowerSafe(error.message), ['cancelled', 'canceled', 'dismissed'])
  );
}

function detectDeviceErrorType(error, source) {
  const message = toLowerSafe(error?.message);
  const code = toLowerSafe(error?.code);
  const name = toLowerSafe(error?.name);

  if (source === 'camera' || source === 'gallery') {
    if (isCancelledError(error)) {
      return DEVICE_ERROR_TYPES.IMAGE_PICKER_CANCELLED;
    }
  }

  if (containsAny(message, ['location services are disabled', 'location services disabled', 'enable location services'])) {
    return DEVICE_ERROR_TYPES.LOCATION_SERVICES_DISABLED;
  }

  if (
    containsAny(message, ['permission denied', 'not granted', 'permission was denied']) ||
    containsAny(code, ['permission']) ||
    containsAny(name, ['permission'])
  ) {
    if (source === 'camera') {
      return DEVICE_ERROR_TYPES.CAMERA_PERMISSION_DENIED;
    }

    if (source === 'gallery') {
      return DEVICE_ERROR_TYPES.GALLERY_PERMISSION_DENIED;
    }

    return DEVICE_ERROR_TYPES.LOCATION_PERMISSION_DENIED;
  }

  if (
    containsAny(message, ['unable to determine current location', 'location unavailable', 'gps unavailable', 'could not get current location', 'could not retrieve location']) ||
    containsAny(code, ['locationunavailable', 'location_unavailable', 'positionunavailable']) ||
    containsAny(name, ['locationunavailable', 'positionunavailable'])
  ) {
    return DEVICE_ERROR_TYPES.GPS_UNAVAILABLE;
  }

  if (source === 'camera' && containsAny(message, ['camera unavailable', 'failed to open camera', 'could not open camera'])) {
    return DEVICE_ERROR_TYPES.UNKNOWN;
  }

  return DEVICE_ERROR_TYPES.UNKNOWN;
}

function getDeviceErrorContent(type, fallbackMessage = '') {
  switch (type) {
    case DEVICE_ERROR_TYPES.LOCATION_SERVICES_DISABLED:
      return {
        type,
        title: 'Location Services Disabled',
        message: 'Please enable location services to capture your current position.',
      };
    case DEVICE_ERROR_TYPES.LOCATION_PERMISSION_DENIED:
      return {
        type,
        title: 'Location Permission Needed',
        message: 'Please allow location access so we can capture the report location.',
      };
    case DEVICE_ERROR_TYPES.CAMERA_PERMISSION_DENIED:
      return {
        type,
        title: 'Camera Permission Needed',
        message: 'Please allow camera access so you can take a photo for the report.',
      };
    case DEVICE_ERROR_TYPES.GALLERY_PERMISSION_DENIED:
      return {
        type,
        title: 'Photo Access Needed',
        message: 'Please allow photo access so you can attach report images.',
      };
    case DEVICE_ERROR_TYPES.IMAGE_PICKER_CANCELLED:
      return {
        type,
        title: 'Selection Cancelled',
        message: 'No image was selected.',
      };
    case DEVICE_ERROR_TYPES.GPS_UNAVAILABLE:
      return {
        type,
        title: 'GPS Unavailable',
        message: 'We could not get your current location. Please try again.',
      };
    default:
      return {
        type: DEVICE_ERROR_TYPES.UNKNOWN,
        title: 'Device Error',
        message: fallbackMessage || 'Something went wrong with your device. Please try again.',
      };
  }
}

export function normalizeDeviceError(error, options = {}) {
  const { source, fallbackMessage } = options;

  const detectedType = options.type || detectDeviceErrorType(error, source);
  const base = getDeviceErrorContent(detectedType, fallbackMessage);

  return {
    type: base.type,
    title: base.title,
    message: base.message,
    primaryAction: DEFAULT_PRIMARY_ACTION,
    secondaryAction: null,
  };
}

export { DEVICE_ERROR_TYPES };