import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyBankAccount = {
  id: string;
  org_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type OrgBankLegacy = {
  bank_name?: string | null;
  bank_account?: string | null;
  bank_account_name?: string | null;
};

export type ResolvedBankDisplay = {
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch: string | null;
  source: "invoice" | "default" | "legacy";
};

export type OrgProfileWithBank = OrgBankLegacy & {
  bank_branch?: string | null;
  [key: string]: unknown;
};

function asText(v: unknown): string {
  return String(v ?? "").trim();
}

export function formatBankAccountLabel(a: Pick<CompanyBankAccount, "bank_name" | "account_number" | "account_holder_name" | "branch" | "is_default">) {
  const parts = [
    a.bank_name,
    a.account_number,
    a.account_holder_name,
    a.branch ? `(${a.branch})` : "",
    a.is_default ? "• default" : "",
  ].filter(Boolean);
  return parts.join(" — ");
}

export async function listCompanyBankAccounts(args: {
  supabase: SupabaseClient;
  orgId: string;
  activeOnly?: boolean;
}): Promise<CompanyBankAccount[]> {
  let q = args.supabase
    .from("company_bank_accounts")
    .select("*")
    .eq("org_id", args.orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (args.activeOnly) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as CompanyBankAccount[];
}

export async function getDefaultBankAccountId(
  supabase: SupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data: defaultRow } = await supabase
    .from("company_bank_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultRow?.id) return String(defaultRow.id);

  const { data: firstRow } = await supabase
    .from("company_bank_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return firstRow?.id ? String(firstRow.id) : null;
}

export async function resolveInvoiceBankAccount(args: {
  supabase: SupabaseClient;
  orgId: string;
  bankAccountId?: string | null;
  orgLegacy?: OrgBankLegacy | null;
}): Promise<ResolvedBankDisplay | null> {
  const { supabase, orgId } = args;
  const selectedId = asText(args.bankAccountId);

  if (selectedId) {
    const { data } = await supabase
      .from("company_bank_accounts")
      .select("bank_name, account_number, account_holder_name, branch")
      .eq("id", selectedId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (data) {
      return {
        bank_name: asText(data.bank_name),
        account_number: asText(data.account_number),
        account_holder_name: asText(data.account_holder_name),
        branch: asText(data.branch) || null,
        source: "invoice",
      };
    }
  }

  const { data: defaultRow } = await supabase
    .from("company_bank_accounts")
    .select("bank_name, account_number, account_holder_name, branch")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultRow) {
    return {
      bank_name: asText(defaultRow.bank_name),
      account_number: asText(defaultRow.account_number),
      account_holder_name: asText(defaultRow.account_holder_name),
      branch: asText(defaultRow.branch) || null,
      source: "default",
    };
  }

  const { data: firstActive } = await supabase
    .from("company_bank_accounts")
    .select("bank_name, account_number, account_holder_name, branch")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstActive) {
    return {
      bank_name: asText(firstActive.bank_name),
      account_number: asText(firstActive.account_number),
      account_holder_name: asText(firstActive.account_holder_name),
      branch: asText(firstActive.branch) || null,
      source: "default",
    };
  }

  const legacy = args.orgLegacy || {};
  const bankName = asText(legacy.bank_name);
  const accountNumber = asText(legacy.bank_account);
  const accountHolder = asText(legacy.bank_account_name);

  if (!bankName && !accountNumber && !accountHolder) return null;

  return {
    bank_name: bankName,
    account_number: accountNumber,
    account_holder_name: accountHolder,
    branch: null,
    source: "legacy",
  };
}

export function applyBankToOrgProfile<T extends OrgProfileWithBank>(
  org: T | null,
  bank: ResolvedBankDisplay | null
): T | null {
  if (!org) return org;
  if (!bank) return org;

  return {
    ...org,
    bank_name: bank.bank_name,
    bank_account: bank.account_number,
    bank_account_name: bank.account_holder_name,
    bank_branch: bank.branch,
  };
}

export async function resolveBankAccountIdForSave(args: {
  supabase: SupabaseClient;
  orgId: string;
  requestedId?: string | null;
  explicitNull?: boolean;
}): Promise<{ ok: true; bank_account_id: string | null } | { ok: false; error: string }> {
  const requested = asText(args.requestedId);

  if (args.explicitNull) {
    return { ok: true, bank_account_id: null };
  }

  if (requested) {
    const { data, error } = await args.supabase
      .from("company_bank_accounts")
      .select("id")
      .eq("id", requested)
      .eq("org_id", args.orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data?.id) {
      return { ok: false, error: "Rekening pembayaran tidak ditemukan atau tidak aktif." };
    }
    return { ok: true, bank_account_id: String(data.id) };
  }

  const defaultId = await getDefaultBankAccountId(args.supabase, args.orgId);
  return { ok: true, bank_account_id: defaultId };
}

export async function clearOtherDefaultBankAccounts(
  supabase: SupabaseClient,
  orgId: string,
  keepId: string
) {
  await supabase
    .from("company_bank_accounts")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .neq("id", keepId)
    .eq("is_default", true);
}
