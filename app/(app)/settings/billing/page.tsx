import { CreditCard, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PRO_FEATURES = [
  "Unlimited entities",
  "Advanced reporting & analytics",
  "Multi-currency support",
  "Cap table management",
  "Investor portal",
  "Priority support",
  "Custom branding",
  "API access",
];

const FREE_FEATURES = [
  "Up to 3 entities",
  "Basic asset tracking",
  "Transaction ledger",
  "Document storage",
];

export default function BillingPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Billing</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Current plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Current plan</CardTitle>
                <CardDescription>You are on the Free plan.</CardDescription>
              </div>
              <Badge variant="secondary">Free</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-3.5 text-muted-foreground shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Separator />

        {/* Upgrade */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-base">Upgrade to Pro</CardTitle>
            </div>
            <CardDescription>
              Unlock the full platform for your team and portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="size-3.5 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-3xl font-bold">€49</p>
                <p className="text-xs text-muted-foreground">
                  per month, billed monthly
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold">€39</p>
                <p className="text-xs text-muted-foreground">
                  per month, billed annually — save 20%
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button>
                <Sparkles className="size-3.5" />
                Upgrade to Pro (monthly)
              </Button>
              <Button variant="outline">Upgrade to Pro (annual)</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Payments are processed securely. Contact{" "}
              <a
                href="mailto:support@fundreporting.com"
                className="underline underline-offset-2"
              >
                support@fundreporting.com
              </a>{" "}
              for enterprise pricing.
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Invoices placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
            <CardDescription>
              Your billing history will appear here once you upgrade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No invoices yet.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
