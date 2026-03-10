"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EntitySheet } from "@/lib/entity-sheets";

type Props = {
  sheet: EntitySheet | null;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
};

export function EditSheetDialog({ sheet, onClose, onSave }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (sheet) {
      setName(sheet.name ?? "");
      setDescription(sheet.description ?? "");
    }
  }, [sheet]);

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!sheet}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit sheet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="edit-sheet-name">Name</Label>
            <Input
              id="edit-sheet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sheet name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-sheet-description">Description</Label>
            <textarea
              id="edit-sheet-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
