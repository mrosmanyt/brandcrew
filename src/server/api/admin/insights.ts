import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  buildWeeklyAnalyticsReport,
  getAdminInsights,
  weeklyReportToCsv,
} from "@/lib/analytics";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const download = (url.searchParams.get("download") || "").trim().toLowerCase();
    if (download === "csv" || download === "json") {
      const report = await buildWeeklyAnalyticsReport();
      const stamp = report.to;
      if (download === "csv") {
        return new NextResponse(weeklyReportToCsv(report), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cinem-insights-week-${stamp}.csv"`,
          },
        });
      }
      return new NextResponse(JSON.stringify(report, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="cinem-insights-week-${stamp}.json"`,
        },
      });
    }
    return jsonOk(await getAdminInsights());
  } catch (error) {
    return jsonError(error);
  }
}
