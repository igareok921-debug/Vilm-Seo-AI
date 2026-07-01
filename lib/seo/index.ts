export interface SeoAuditRequest {
  websiteId: string;
  includePerformance?: boolean;
}

export async function runSeoAudit(_request: SeoAuditRequest) {
  void _request;
  throw new Error("The SEO audit integration is not active yet.");
}
