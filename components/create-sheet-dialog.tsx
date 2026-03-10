"use client";

import * as React from "react";
import { LayoutPanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSubmit: (name: string, description: string) => Promise<void>;
};

export function CreateSheetDialog({ onSubmit }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), description.trim());
      setName("");
      setDescription("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LayoutPanelTop />
          New sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create asset sheet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="sheet-name">Name</Label>
            <Input
              id="sheet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liquid Assets"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sheet-description">Description</Label>
            <textarea
              id="sheet-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim()}
          >
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
