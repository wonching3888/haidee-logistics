"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  getMultiOriginConfig,
  saveMultiOriginCustomerConfig,
} from "@/app/actions/multi-origin-customer";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface MultiOriginCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipperId: string;
  shipperName: string;
  shipperCode: string;
}

export function MultiOriginCustomerDialog({
  open,
  onOpenChange,
  shipperId,
  shipperName,
  shipperCode,
}: MultiOriginCustomerDialogProps) {
  const router = useRouter();
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [isMultiOrigin, setIsMultiOrigin] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shipperId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getMultiOriginConfig(shipperId)
      .then((config) => {
        if (cancelled) return;
        setIsMultiOrigin(config.isMultiOrigin);
        setLocations(config.locations);
        setNewLocation("");
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("error.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, shipperId, t]);

  function handleAddLocation() {
    const name = newLocation.trim();
    if (!name) return;
    const exists = locations.some(
      (loc) => loc.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setError(t("multiOrigin.error.duplicate"));
      return;
    }
    setLocations((prev) => [...prev, name]);
    setNewLocation("");
    setError(null);
  }

  function handleRemoveLocation(index: number) {
    setLocations((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveMultiOriginCustomerConfig({
          shipperId,
          isMultiOrigin,
          locations,
        });
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("multiOrigin.configTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-haidee-muted">
            {shipperName}{" "}
            <span className="font-mono text-xs">({shipperCode})</span>
          </p>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isMultiOrigin}
              onChange={(e) => setIsMultiOrigin(e.target.checked)}
              disabled={loading || isPending}
              className="h-4 w-4 rounded border-haidee-border"
            />
            {t("multiOrigin.isMultiOrigin")}
          </label>

          {isMultiOrigin ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-haidee-muted">
                {t("multiOrigin.standardLocations")}
              </p>
              {loading ? (
                <p className="text-sm text-haidee-muted">…</p>
              ) : locations.length === 0 ? (
                <p className="text-sm text-haidee-muted">
                  {t("multiOrigin.noLocations")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {locations.map((loc, index) => (
                    <li
                      key={`${loc}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-haidee-border px-3 py-2 text-sm"
                    >
                      <span className="font-mono">{loc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(index)}
                        disabled={isPending}
                        className="text-haidee-muted hover:text-red-600"
                        aria-label={t("common.delete")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
                  placeholder={t("multiOrigin.locationPlaceholder")}
                  disabled={loading || isPending}
                  className="min-h-[44px] font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddLocation}
                  disabled={loading || isPending || !newLocation.trim()}
                  className="min-h-[44px] shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || isPending}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
