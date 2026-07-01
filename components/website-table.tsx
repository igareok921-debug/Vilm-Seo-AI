import {
  ArrowUpRight,
  Eye,
  FileSearch,
  Globe2,
  SearchCode,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeoScoreCard } from "@/components/seo-score-card";
import { WebsiteDeleteAction } from "@/components/website-delete-action";
import { formatDate } from "@/lib/utils";
import type { Website } from "@/types";

interface WebsiteTableLabels {
  seoScore: string;
  pages: string;
  status: string;
  lastAudit: string;
  actions: string;
  details: string;
  detailsTooltip: string;
  crawlTooltip: string;
  auditTooltip: string;
  delete: string;
  deleteTooltip: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteCancel: string;
  deleteConfirm: string;
  deleteSuccess: string;
  deleteFailed: string;
}

export function WebsiteTable({ data, labels }: { data: Website[]; labels: WebsiteTableLabels }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead className="border-b bg-secondary/40">
            <tr className="text-xs font-medium text-muted-foreground">
              <th className="px-5 py-3.5">Website</th>
              <th className="px-5 py-3.5">{labels.seoScore}</th>
              <th className="px-5 py-3.5">{labels.pages}</th>
              <th className="px-5 py-3.5">{labels.status}</th>
              <th className="px-5 py-3.5">{labels.lastAudit}</th>
              <th className="px-5 py-3.5 text-right">{labels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((website) => (
              <tr key={website.id} className="group transition hover:bg-secondary/30">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl border bg-secondary/60 text-primary">
                      <Globe2 className="size-[18px]" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{website.name}</p>
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        {website.url.replace("https://", "")}
                        <ArrowUpRight className="size-3" />
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <SeoScoreCard score={website.score} size="sm" />
                </td>
                <td className="px-5 py-4 text-sm">
                  <span className="font-medium">{website.pages}</span>
                  <span className="ml-1 text-muted-foreground">{labels.pages.toLowerCase()}</span>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={website.status === "Active" || website.status === "Activ" ? "success" : "warning"}>
                    <span className="mr-1.5 size-1.5 rounded-full bg-current" />
                    {website.status}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-xs text-muted-foreground">
                  {formatDate(website.lastAudit)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-lg px-2.5 transition hover:bg-primary/10 hover:text-primary"
                      title={labels.detailsTooltip}
                    >
                      <Link href={`/websites/${website.id}`}>
                        <Eye className="size-4" />
                        {labels.details}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-lg px-2.5 transition hover:bg-primary/10 hover:text-primary"
                      title={labels.crawlTooltip}
                    >
                      <Link href={`/crawl?websiteId=${encodeURIComponent(website.id)}`}>
                        <SearchCode className="size-4" />
                        Crawl
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-lg px-2.5 transition hover:bg-primary/10 hover:text-primary"
                      title={labels.auditTooltip}
                    >
                      <Link href={`/audit?websiteId=${encodeURIComponent(website.id)}`}>
                        <FileSearch className="size-4" />
                        Audit
                      </Link>
                    </Button>
                    <WebsiteDeleteAction
                      websiteId={website.id}
                      websiteName={website.name}
                      labels={{
                        delete: labels.delete,
                        deleteTooltip: labels.deleteTooltip,
                        deleteTitle: labels.deleteTitle,
                        deleteDescription: labels.deleteDescription,
                        deleteCancel: labels.deleteCancel,
                        deleteConfirm: labels.deleteConfirm,
                        deleteSuccess: labels.deleteSuccess,
                        deleteFailed: labels.deleteFailed,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
