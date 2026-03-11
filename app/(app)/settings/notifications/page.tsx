"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type NotifSetting = {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
};

const SECTIONS: {
  title: string;
  description: string;
  items: NotifSetting[];
}[] = [
  {
    title: "Activity",
    description: "Alerts for things happening inside your entities.",
    items: [
      {
        id: "capital_calls",
        label: "Capital calls",
        description: "When a new capital call is issued to you.",
        defaultOn: true,
      },
      {
        id: "task_assigned",
        label: "Task assigned",
        description: "When a task is assigned to you.",
        defaultOn: true,
      },
      {
        id: "document_uploaded",
        label: "Document uploaded",
        description: "When a new document is added to an entity you belong to.",
        defaultOn: false,
      },
      {
        id: "transaction_recorded",
        label: "Transaction recorded",
        description: "When a new transaction is recorded on an entity.",
        defaultOn: false,
      },
    ],
  },
  {
    title: "Team",
    description: "Notifications about your team and entity members.",
    items: [
      {
        id: "member_invited",
        label: "Member invited",
        description: "When someone is invited to an entity you manage.",
        defaultOn: true,
      },
      {
        id: "member_joined",
        label: "Member joined",
        description: "When an invited member accepts and joins.",
        defaultOn: false,
      },
    ],
  },
  {
    title: "System",
    description: "Platform and security notifications.",
    items: [
      {
        id: "security_login",
        label: "New sign-in",
        description: "When your account is accessed from a new device.",
        defaultOn: true,
      },
      {
        id: "product_updates",
        label: "Product updates",
        description: "New features and improvements to the platform.",
        defaultOn: false,
      },
    ],
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      SECTIONS.flatMap((s) => s.items).map((item) => [item.id, item.defaultOn]),
    ),
  );

  function toggle(id: string) {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Notifications</h1>
      </div>

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section, i) => (
          <div key={section.title}>
            {i > 0 && <Separator className="mb-6" />}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Label
                        htmlFor={item.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      id={item.id}
                      checked={settings[item.id]}
                      onCheckedChange={() => toggle(item.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
