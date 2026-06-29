"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAgentMember,
  createCrateStockAgent,
  removeAgentMember,
  searchEligibleAgentMembers,
  type EligibleAgentMemberOption,
} from "@/app/actions/customer-crate-stock-agent";
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

interface CrateStockAgentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrateStockAgentCreateDialog({
  open,
  onOpenChange,
}: CrateStockAgentCreateDialogProps) {
  const router = useRouter();
  const { t, parts } = useT();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setCode("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await createCrateStockAgent({
          name,
          code: code.trim() || undefined,
          notes: notes.trim() || undefined,
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
          <DialogTitle>{t("customerCrateStock.agent.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-haidee-muted">
              {t("customerCrateStock.agent.name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-haidee-muted">
              {t("customerCrateStock.agent.code")}
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="AGENT-..."
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-haidee-muted">
              {t("customerCrateStock.agent.notes")}
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={parts("common.optional").local}
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmMemberAction {
  type: "join" | "remove";
  agentId: string;
  agentName: string;
  memberId: string;
  memberName: string;
}

interface CrateStockAgentConfirmDialogProps {
  action: ConfirmMemberAction | null;
  onClose: () => void;
}

export function CrateStockAgentConfirmDialog({
  action,
  onClose,
}: CrateStockAgentConfirmDialogProps) {
  const router = useRouter();
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!action) return;
    setError(null);
    startTransition(async () => {
      try {
        if (action.type === "join") {
          await addAgentMember(action.agentId, action.memberId);
        } else {
          await removeAgentMember(action.memberId);
        }
        onClose();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
      }
    });
  }

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action?.type === "join"
              ? t("customerCrateStock.agent.confirmJoinTitle")
              : t("customerCrateStock.agent.confirmRemoveTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-haidee-text">
          {action?.type === "join"
            ? t("customerCrateStock.agent.confirmJoinBody", {
                member: action.memberName,
                agent: action.agentName,
              })
            : action
              ? t("customerCrateStock.agent.confirmRemoveBody", {
                  member: action.memberName,
                  agent: action.agentName,
                })
              : ""}
        </p>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? t("common.processing") : t("inbound.confirmSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CrateStockAgentAddMemberDialogProps {
  open: boolean;
  agentName: string;
  onOpenChange: (open: boolean) => void;
  onRequestJoin: (member: EligibleAgentMemberOption) => void;
}

export function CrateStockAgentAddMemberDialog({
  open,
  agentName,
  onOpenChange,
  onRequestJoin,
}: CrateStockAgentAddMemberDialogProps) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EligibleAgentMemberOption[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    startTransition(async () => {
      const rows = await searchEligibleAgentMembers("");
      setResults(rows);
    });
  }, [open]);

  function runSearch(value: string) {
    setQuery(value);
    startTransition(async () => {
      const rows = await searchEligibleAgentMembers(value);
      setResults(rows);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("customerCrateStock.agent.addMember")} — {agentName}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder={t("customerCrateStock.agent.searchMember")}
          className="min-h-[44px]"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-haidee-border p-2">
          {results.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-haidee-muted">
              {t("customerCrateStock.emptySearch")}
            </p>
          ) : (
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={isPending}
                onClick={() => {
                  onOpenChange(false);
                  onRequestJoin(row);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-haidee-surface"
              >
                <span>{row.name}</span>
                <span className="font-mono text-xs text-haidee-muted">
                  {row.code}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
