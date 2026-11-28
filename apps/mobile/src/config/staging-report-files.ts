export function stagingReportFilesEnabled() {
  return (
    process.env.EXPO_PUBLIC_STAGING_REPORT_FILES === 'true' &&
    process.env.EXPO_PUBLIC_API_URL ===
      'https://api.staging.masarifiratibi.com/qa-reports'
  );
}
