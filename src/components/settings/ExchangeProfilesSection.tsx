"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
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

interface ExchangeProfilesSectionProps {
  minimal?: boolean; // For embedding in other pages
}

export default function ExchangeProfilesSection({
  minimal = false,
}: ExchangeProfilesSectionProps) {
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
    } catch (err) {
      console.error("Failed to load exchange profiles:", err);
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
      console.error("Failed to save profile:", err);
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
      console.error("Failed to delete profile:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className={minimal ? "" : "mb-6"}>
        <CardHeader title="Exchange Profiles" icon="🔌" />
        <CardBody>
          <div className="text-center py-8 text-text-2">Loading...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className={minimal ? "" : "mb-6"}>
        <CardHeader
          title="Exchange Profiles"
          icon="🔌"
          action={
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 text-sm bg-green text-black rounded-md font-medium hover:bg-green/90 transition"
            >
              + Add Profile
            </button>
          }
        />
        <CardBody>
          {profiles.length === 0 ? (
            <div className="text-center py-8 text-text-2">
              No exchange profiles yet. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-semibold text-text-1">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-text-1">
                      Exchange
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-text-1">
                      API Key
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-text-1">
                      Created
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-text-1">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="border-b border-border/50 hover:bg-bg-3/50 transition"
                    >
                      <td className="px-4 py-3 text-text-0 font-medium">
                        {profile.name}
                      </td>
                      <td className="px-4 py-3 text-text-1">
                        <span className="px-2 py-1 bg-bg-3 rounded text-xs font-mono uppercase">
                          {profile.exchange_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-2">
                        <Tooltip
                          content={
                            profile.has_api_key
                              ? "API key configured"
                              : "No API key"
                          }
                        >
                          <span className="font-mono text-xs">
                            {profile.has_api_key ? "••••••••" : "–"}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3 text-text-2 text-xs">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                        <button
                          onClick={() => openEditModal(profile)}
                          className="px-2 py-1 text-xs bg-bg-3 hover:bg-bg-3/80 text-text-1 rounded transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirming(profile.id)}
                          className="px-2 py-1 text-xs bg-red/10 hover:bg-red/20 text-red rounded transition"
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
        </CardBody>
      </Card>

      {/* Edit/Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader
              title={editingId ? "Edit Profile" : "New Exchange Profile"}
              action={
                <button
                  onClick={closeModal}
                  className="text-text-2 hover:text-text-0 text-xl"
                >
                  ×
                </button>
              }
            />
            <CardBody>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Main Binance, Backup Kraken"
                    className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                  />
                </div>

                {/* Exchange */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
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
                    className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-text-1">
                      API Key
                    </label>
                    {editingId && (
                      <button
                        onClick={() =>
                          setShowApiKeyChange(!showApiKeyChange)
                        }
                        className="text-xs text-green hover:text-green/80"
                      >
                        {showApiKeyChange ? "Cancel" : "Change"}
                      </button>
                    )}
                  </div>
                  {editingId && !showApiKeyChange ? (
                    <div className="px-3 py-2 bg-bg-3 border border-border rounded text-text-2 text-sm font-mono">
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
                      className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                    />
                  )}
                </div>

                {/* API Secret */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
                    API Secret
                  </label>
                  {editingId && !showApiKeyChange ? (
                    <div className="px-3 py-2 bg-bg-3 border border-border rounded text-text-2 text-sm font-mono">
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
                      className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                    />
                  )}
                </div>

                {/* API Password (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
                    API Password{" "}
                    <span className="text-text-2 text-xs">(optional)</span>
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
                    className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                  />
                </div>

                {/* UID (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
                    UID <span className="text-text-2 text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.uid}
                    onChange={(e) =>
                      setFormData({ ...formData, uid: e.target.value })
                    }
                    placeholder="Leave blank if not needed"
                    className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                  />
                </div>

                {/* Subaccount (optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1">
                    Subaccount{" "}
                    <span className="text-text-2 text-xs">(optional)</span>
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
                    className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-text-0 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-3 py-2 bg-bg-3 hover:bg-bg-3/80 text-text-1 rounded text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-green hover:bg-green/90 text-black rounded text-sm font-medium transition disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirming !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader title="Confirm Delete" action={
              <button
                onClick={() => setDeleteConfirming(null)}
                className="text-text-2 hover:text-text-0 text-xl"
              >
                ×
              </button>
            } />
            <CardBody>
              <div className="space-y-4">
                <p className="text-text-1">
                  Are you sure you want to delete this exchange profile? This
                  action is permanent.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirming(null)}
                    className="flex-1 px-3 py-2 bg-bg-3 hover:bg-bg-3/80 text-text-1 rounded text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteProfile(deleteConfirming)
                    }
                    disabled={submitting}
                    className="flex-1 px-3 py-2 bg-red hover:bg-red/90 text-white rounded text-sm font-medium transition disabled:opacity-50"
                  >
                    {submitting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
