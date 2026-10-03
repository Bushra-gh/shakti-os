import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FACTOR_LABELS, RISK_WEIGHTS, riskPercent } from "@/lib/format";
import { SeverityBadge } from "@/components/dashboard/badges";
import { cn } from "@/lib/utils";

const FACTOR_ORDER = ["crowd_density", "social_velocity", "abnormal_movement", "citizen_reports"];

/** Large explainable risk display. Values come from backend factors only. */
export function RiskScore({
  risk,
  severity,
  confidence,
  compact,
}: {
  risk: number;
  severity: string;
  confidence?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-4", compact && "gap-3")}>
      <div
        className={cn(
          "flex size-20 shrink-0 items-center justify-center rounded-full bg-muted",
          compact && "size-14",
        )}
        role="img"
        aria-label={`Risk ${riskPercent(risk)} percent, severity ${severity}`}
      >
        <span className={cn("text-2xl font-medium tracking-tight", compact && "text-lg")}>
          {riskPercent(risk)}%
        </span>
      </div>
      <div className="min-w-0">
        <SeverityBadge value={severity} />
        {typeof confidence === "number" && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {Math.round(confidence * 100)}% confidence
          </p>
        )}
      </div>
    </div>
  );
}

/** Deterministic weighted factor breakdown. Never hardcodes values. */
export function RiskFactors({ factors }: { factors: Record<string, number> }) {
  return (
    <Card className="rounded-xl bg-card py-0 ring-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          Explainable risk
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex cursor-help items-center text-muted-foreground" />
              }
            >
              <Info className="size-3.5" aria-hidden />
              <span className="sr-only">How risk is calculated</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 rounded-xl text-xs">
              Deterministic weighted risk calculation — not an AI prediction. Weights: crowd
              density 0.4, social velocity 0.3, abnormal movement 0.2, citizen reports 0.1.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Deterministic weighted calculation — not an AI prediction.
        </p>
      </CardHeader>
      <CardContent className="space-y-3.5 p-5">
        {FACTOR_ORDER.map((factor) => {
          const raw = typeof factors[factor] === "number" ? (factors[factor] as number) : 0;
          const weight = RISK_WEIGHTS[factor] ?? 0;
          const contribution = raw * weight;
          return (
            <div key={factor}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{FACTOR_LABELS[factor] ?? factor}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {raw.toFixed(2)} × {weight.toFixed(1)} = {contribution.toFixed(3)}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(raw * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={FACTOR_LABELS[factor] ?? factor}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(raw * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        {typeof factors.citizen_report_count === "number" && (
          <p className="text-xs text-muted-foreground">
            {factors.citizen_report_count} citizen report
            {factors.citizen_report_count === 1 ? "" : "s"} counted (capped at 5).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
