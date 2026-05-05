"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type User = { id: number; name: string; email: string; created_at: string; avatar?: { url?: string } | null };

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/auth/me/avatar", { method: "POST", body: fd });
      if (res.ok) {
        const updated = await res.json() as User;
        setUser(updated);
        setProfileMsg("Profile picture updated.");
      } else {
        const d = await res.json() as { error?: string };
        setProfileMsg(d.error ?? "Failed to upload.");
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d);
        setName(d.name ?? "");
      });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setProfileMsg("Profile updated.");
      } else {
        const d = await res.json();
        setProfileMsg(d.error ?? "Failed to update.");
      }
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <BadgeCheck className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Account</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              Update your display name and email address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              {/* Avatar upload */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar size="lg">
                    {user?.avatar?.url && <AvatarImage src={user.avatar.url} alt={user.name} />}
                    <AvatarFallback>
                      {user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Change profile picture"
                  >
                    {uploadingAvatar ? <Loader2 className="size-4 text-white animate-spin" /> : <Camera className="size-4 text-white" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div>
                  <p className="text-sm font-medium">Profile picture</p>
                  <p className="text-xs text-muted-foreground">Click the avatar to upload a new photo.</p>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here. Contact support.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={savingProfile}>
                  {savingProfile ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save profile
                </Button>
                {profileMsg && (
                  <p className="text-xs text-muted-foreground">{profileMsg}</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Danger zone
            </CardTitle>
            <CardDescription>
              Irreversible actions for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data. This
                  cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" disabled>
                Delete account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
