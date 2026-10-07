// Single locale for number/date formatting. Without an explicit locale,
// Intl falls back to the runtime default, which differs between the server
// and the visitor's browser and breaks hydration. Keep in sync with <html lang>.
export const APP_LOCALE = "ru-RU"
