const API_ERROR_TYPES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  BAD_REQUEST: 'bad_request',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  SERVER_ERROR: 'server_error',
  UNKNOWN: 'unknown_error',
};

const DEFAULT_PRIMARY_ACTION = {
  label: 'OK',
  variant: 'primary',
};

const DEFAULT_RETRY_ACTION = {
  label: 'Try Again',
  variant: 'primary',
};

const DEFAULT_DISMISS_ACTION = {
  label: 'Dismiss',
  variant: 'secondary',
};

function toLowerSafe(value) {
  return String(value || '').trim().toLowerCase();
}

function isTimeoutError(error) {
  const name = toLowerSafe(error?.name);
  const code = toLowerSafe(error?.code);
  const message = toLowerSafe(error?.message);

  return (
    name === 'abortederror' ||
    code === 'aborted' ||
    code === 'etimedout' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('abort')
  );
}

function isNetworkError(error) {
  const message = toLowerSafe(error?.message);
  const name = toLowerSafe(error?.name);

  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message === 'network error' ||
    message.includes('networkerror') ||
    name === 'typeerror'
  );
}

function extractStatus(error, fallbackStatus) {
  const statusCandidates = [
    fallbackStatus,
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
  ];

  for (const candidate of statusCandidates) {
    const status = Number(candidate);
    if (Number.isInteger(status) && status > 0) {
      return status;
    }
  }

  return null;
}

function extractResponseMessage(error) {
  const responseData = error?.responseData || error?.data || error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === 'object') {
    const message = responseData.message || responseData.error || responseData.detail;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return '';
}

function extractMessage(error, fallbackMessage = '') {
  const responseMessage = extractResponseMessage(error);
  if (responseMessage) {
    return responseMessage;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof fallbackMessage === 'string' && fallbackMessage.trim()) {
    return fallbackMessage.trim();
  }

  return '';
}

function buildApiError(type, title, message, primaryAction, secondaryAction = null) {
  return {
    type,
    title,
    message,
    primaryAction,
    secondaryAction,
  };
}

function buildStatusError(status, error) {
  const responseMessage = extractResponseMessage(error);
  const message = extractMessage(error, responseMessage);

  switch (status) {
    case 400:
      return buildApiError(
        API_ERROR_TYPES.BAD_REQUEST,
        'Bad Request',
        message || 'The request could not be processed. Please check your input and try again.',
        DEFAULT_PRIMARY_ACTION
      );
    case 401:
      return buildApiError(
        API_ERROR_TYPES.UNAUTHORIZED,
        'Session Required',
        message || 'Your session has expired or you are not signed in.',
        {
          label: 'Sign In',
          variant: 'primary',
        },
        DEFAULT_DISMISS_ACTION
      );
    case 403:
      return buildApiError(
        API_ERROR_TYPES.FORBIDDEN,
        'Access Denied',
        message || 'You do not have permission to perform this action.',
        DEFAULT_PRIMARY_ACTION
      );
    case 404:
      return buildApiError(
        API_ERROR_TYPES.NOT_FOUND,
        'Not Found',
        message || 'The requested resource could not be found.',
        DEFAULT_PRIMARY_ACTION
      );
    case 429:
      return buildApiError(
        API_ERROR_TYPES.RATE_LIMITED,
        'Too Many Requests',
        message || 'You are making requests too quickly. Please wait and try again.',
        DEFAULT_RETRY_ACTION,
        DEFAULT_DISMISS_ACTION
      );
    default:
      if (status >= 500) {
        return buildApiError(
          API_ERROR_TYPES.SERVER_ERROR,
          'Server Error',
          message || 'Something went wrong on our side. Please try again soon.',
          DEFAULT_RETRY_ACTION,
          DEFAULT_DISMISS_ACTION
        );
      }

      return buildApiError(
        API_ERROR_TYPES.UNKNOWN,
        'Unexpected Error',
        message || 'Something went wrong. Please try again.',
        DEFAULT_PRIMARY_ACTION
      );
  }
}

export function normalizeApiError(error, options = {}) {
  const { fallbackStatus, fallbackMessage } = options;
  const status = extractStatus(error, fallbackStatus);

  if (isTimeoutError(error)) {
    return buildApiError(
      API_ERROR_TYPES.TIMEOUT,
      'Request Timed Out',
      extractMessage(error, fallbackMessage) || 'The request took too long to complete. Please try again.',
      DEFAULT_RETRY_ACTION,
      DEFAULT_DISMISS_ACTION
    );
  }

  if (isNetworkError(error)) {
    return buildApiError(
      API_ERROR_TYPES.NETWORK,
      'Network Error',
      extractMessage(error, fallbackMessage) || 'Please check your internet connection and try again.',
      DEFAULT_RETRY_ACTION,
      DEFAULT_DISMISS_ACTION
    );
  }

  if (status) {
    return buildStatusError(status, error);
  }

  return buildApiError(
    API_ERROR_TYPES.UNKNOWN,
    'Unexpected Error',
    extractMessage(error, fallbackMessage) || 'Something went wrong. Please try again.',
    DEFAULT_PRIMARY_ACTION
  );
}

export { API_ERROR_TYPES };