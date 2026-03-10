"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntitySection } from "@/lib/entity-sheets";

type AssetOption = {
  id: string;
  name: string | null;
};

type Props = {
  sheetName: string;
  sections: EntitySection[];
  availableAssets: AssetOption[];
  onSubmit: (assetId: string, sectionId: string) => Promise<void>;
};

export function AddAssetToSheetDialog({
  sheetName,
  sections,
  availableAssets,
  onSubmit,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [assetId, setAssetId] = React.useState("");
  const [sectionId, setSectionId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async () => {
    if (!assetId) return;
    setSaving(true);
    try {
      await onSubmit(assetId, sectionId === "__none__" ? "" : sectionId);
      setAssetId("");
      setSectionId("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus />
          Add existing asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add asset to {sheetName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select asset..." />
              </SelectTrigger>
              <SelectContent>
                {availableAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Section (optional)</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unsectioned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unsectioned</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !assetId}
          >
            {saving ? "Adding..." : "Add to sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
