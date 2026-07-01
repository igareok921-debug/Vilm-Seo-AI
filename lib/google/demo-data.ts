import type { SearchConsoleDashboardData } from "@/types";

export const searchConsoleDemoData: SearchConsoleDashboardData = {
  source: "empty",
  connected: false,
  property: null,
  period: {
    startDate: "",
    endDate: "",
  },
  metrics: {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  },
  topQueries: [],
  topPages: [],
  decliningPages: [],
  opportunities: [],
  error: "The Google Search Console integration is not connected.",
};
