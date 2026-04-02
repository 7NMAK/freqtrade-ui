"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  getExchangeProfiles,
  createExchangeProfile,
  updateExchangeProfile,
  deleteExchangeProfile,
} from "@/lib/api";
import type { ExchangeProfile } from "@/types";

const SUPPORTED_EXCHANGES = [
  "binance",
  "bybit",
  "okx",
  "hyperliquid",
  "bitget",
  "kraken",
  "kucoin",
  "gate",
];

interface ProfileFormData {
  name: string;
  exchange_name: string;
  api_key: string;
  api_secret: string;
  api_password: string;
  uid: string;
  subaccount: string;
}

export default function SystemSettingsTab() {
  const toast = useToast();

  // Data
  const [profiles, setProfiles] = useState<ExchangeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    exchange_name: "binance",
    api_key: "",
    api_secret: "",
    api_password: "",
    uid: "",
    subaccount: "",
  });
  const [showApiKeyChange, setShowApiKeyChange] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirming, setDeleteConfirming] = useState<number | null>(null);

  // Load profiles
  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfiles() {
    try {
      setLoading(true);
      const data = await getExchangeProfiles();
      // API returns { total, items }
      setProfiles(data.items || []);
    } catch {
      toast.error("Failed to load exchange profiles");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingId(null);
    setFormData({
      name: "",
      exchange_name: "binance",
      api_key: "",
      api_secret: "",
      api_password: "",
      uid: "",
      subaccount: "",
    });
    setShowApiKeyChange(false);
    setModalOpen(true);
  }

  function openEditModal(profile: ExchangeProfile) {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      exchange_name: profile.exchange_name,
      api_key: "", // Never pre-fill
      api_secret: "", // Never pre-fill
      api_password: "",
      uid: profile.uid || "",
      subaccount: profile.subaccount || "",
    });
    setShowApiKeyChange(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setShowApiKeyChange(false);
    setFormData({
      name: "",
      exchange_name: "binance",
      api_key: "",
      api_secret: "",
      api_password: "",
      uid: "",
      subaccount: "",
    });
  }

  async function handleSaveProfile() {
    // Validate
    if (!formData.name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    if (!formData.exchange_name) {
      toast.error("Exchange is required");
      return;
    }

    // For new profiles or when changing API key, require both key and secret
    if (editingId === null || showApiKeyChange) {
      if (!formData.api_key.trim()) {
        toast.error("API key is required");
        return;
      }
      if (!formData.api_secret.trim()) {
        toast.error("API secret is required");
        return;
      }
    }

    try {
      setSubmitting(true);

      if (editingId === null) {
        // Create new
        await createExchangeProfile({
          name: formData.name,
          exchange_name: formData.exchange_name,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined,
          api_password: formData.api_password || undefined,
          uid: formData.uid || undefined,
          subaccount: formData.subaccount || undefined,
        });
        toast.success("Profile created successfully");
      } else {
        // Update existing
        const updatePayload: Record<string, unknown> = {
          name: formData.name,
          exchange_name: formData.exchange_name,
        };

        // Only include API credentials if being changed
        if (showApiKeyChange) {
          updatePayload.api_key = formData.api_key;
          updatePayload.api_secret = formData.api_secret;
        }

        if (formData.api_password) {
          updatePayload.api_password = formData.api_password;
        }
        if (formData.uid) {
          updatePayload.uid = formData.uid;
        }
        if (formData.subaccount) {
          updatePayload.subaccount = formData.subaccount;
        }

        await updateExchangeProfile(editingId, updatePayload);
        toast.success("Profile updated successfully");
      }

      await loadProfiles();
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProfile(id: number) {
    try {
      setSubmitting(true);
      await deleteExchangeProfile(id);
      toast.success("Profile deleted successfully");
      await loadProfiles();
      setDeleteConfirming(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-foreground mb-2">System Settings</h2>
      <p className="text-xs text-muted-foreground mb-7">Manage exchange credentials and system-wide configuration</p>

      {/* Exchange Profiles Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>🔌</span> Exchange Profiles
          </h3>
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 text-xs bg-primary text-white rounded-btn font-semibold hover:bg-primary-dim transition"
          >
            + Add Profile
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-3">No exchange profiles yet.</p>
            <p className="text-xs">Create a profile to store reusable API credentials.</p>
          </div>
        ) : (
          <div className="border border-border rounded-btn overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">
                    Exchange
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">
                    API Key
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition"
                  >
                    <td className="px-4 py-2.5 text-foreground font-medium">
                      {profile.name}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono uppercase">
                        {profile.exchange_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="font-mono text-xs">
                        {profile.has_api_key ? "••••••••" : "–"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1.5 flex justify-end">
                      <button
                        onClick={() => openEditModal(profile)}
                        className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirming(profile.id)}
                        className="px-2 py-1 text-xs bg-red/10 hover:bg-red/20 text-rose-500 rounded transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-muted/50 border border-border rounded-card overflow-hidden w-full max-w-md mx-4">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Profile" : "New Exchange Profile"}
              </h3>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Main Binance, Backup Kraken"
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Exchange */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Exchange
                </label>
                <select
                  value={formData.exchange_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      exchange_name: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary cursor-pointer appearance-none bg-no-repeat bg-[right_12px_center] pr-8"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23808098'/%3E%3C/svg%3E")` }}
                >
                  {SUPPORTED_EXCHANGES.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex.charAt(0).toUpperCase() + ex.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    API Key
                  </label>
                  {editingId && (
                    <button
                      onClick={() =>
                        setShowApiKeyChange(!showApiKeyChange)
                      }
                      className="text-xs text-primary hover:text-primary-dim font-semibold"
                    >
                      {showApiKeyChange ? "Cancel" : "Change"}
                    </button>
                  )}
                </div>
                {editingId && !showApiKeyChange ? (
                  <div className="px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-muted-foreground text-xs font-mono">
                    ••••••••
                  </div>
                ) : (
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) =>
                      setFormData({ ...formData, api_key: e.target.value })
                    }
                    placeholder="Enter API key"
                    className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                  />
                )}
              </div>

              {/* API Secret */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  API Secret
                </label>
                {editingId && !showApiKeyChange ? (
                  <div className="px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-muted-foreground text-xs font-mono">
                    ••••••••
                  </div>
                ) : (
                  <input
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_secret: e.target.value,
                      })
                    }
                    placeholder="Enter API secret"
                    className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                  />
                )}
              </div>

              {/* API Password (optional) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  API Password{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  value={formData.api_password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      api_password: e.target.value,
                    })
                  }
                  placeholder="Leave blank if not needed"
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* UID (optional) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  UID <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.uid}
                  onChange={(e) =>
                    setFormData({ ...formData, uid: e.target.value })
                  }
                  placeholder="Leave blank if not needed"
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Subaccount (optional) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Subaccount{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.subaccount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      subaccount: e.target.value,
                    })
                  }
                  placeholder="Leave blank if not needed"
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-btn text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <button
                  onClick={closeModal}
                  className="flex-1 px-3.5 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-btn text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={submitting}
                  className="flex-1 px-3.5 py-2.5 bg-primary hover:bg-primary-dim text-white rounded-btn text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirming !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-muted/50 border border-border rounded-card overflow-hidden w-full max-w-sm mx-4">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Confirm Delete</h3>
              <button
                onClick={() => setDeleteConfirming(null)}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Are you sure you want to delete this exchange profile? This action is permanent.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirming(null)}
                  className="flex-1 px-3.5 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-btn text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleDeleteProfile(deleteConfirming)
                  }
                  disabled={submitting}
                  className="flex-1 px-3.5 py-2.5 bg-red hover:bg-red/90 text-white rounded-btn text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
