export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  formatted: string;
}

export interface CountryCodeOption {
  country: string;
  code: string;
  flag: string;
}

export const COMMON_COUNTRY_CODES: CountryCodeOption[] = [
  { country: 'United States / Canada', code: '+1', flag: '🇺🇸' },
  { country: 'India', code: '+91', flag: '🇮🇳' },
  { country: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { country: 'Australia', code: '+61', flag: '🇦🇺' },
  { country: 'Germany', code: '+49', flag: '🇩🇪' },
  { country: 'France', code: '+33', flag: '🇫🇷' },
  { country: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { country: 'Singapore', code: '+65', flag: '🇸🇬' },
  { country: 'Japan', code: '+81', flag: '🇯🇵' },
  { country: 'Brazil', code: '+55', flag: '🇧🇷' },
  { country: 'South Africa', code: '+27', flag: '🇿🇦' },
  { country: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { country: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { country: 'Bangladesh', code: '+880', flag: '🇧🇩' },
];

/**
 * Validates whether the given string is a plausible international or national phone number.
 * Requirement: Phone number is compulsory for all users.
 */
export function validatePhoneNumber(raw: string): PhoneValidationResult {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Phone number is mandatory and cannot be empty.',
      formatted: '',
    };
  }

  // Check for invalid characters (only digits, +, -, (, ), space allowed)
  if (!/^[+]?[\d\s\-().]{7,25}$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid phone format. Please use digits with optional country code (e.g. +1 555-019-2834).',
      formatted: trimmed,
    };
  }

  // Count raw digits
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return {
      isValid: false,
      error: 'Phone number is too short. Please provide at least 7 digits.',
      formatted: trimmed,
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      error: 'Phone number exceeds maximum length of 15 digits (ITU E.164 standard).',
      formatted: trimmed,
    };
  }

  // Standardize: If it doesn't start with +, ensure clean display
  const hasPlus = trimmed.startsWith('+');
  const cleanFormatted = hasPlus ? `+${digitsOnly}` : trimmed;

  return {
    isValid: true,
    formatted: trimmed, // keep user formatting like +1 (555) 019-2834
  };
}

export function formatPhoneForCall(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}
