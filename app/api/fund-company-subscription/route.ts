import { getAuthToken } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanySubscriptionBody {
  // Investor / UBO
  email?: string;              // UBO email — used to find/create user account
  name: string;                // Company name — used for shareholder + company record
  companyEntityUUID?: string;  // If provided, skip company lookup/creation entirely
  // Context
  fundEntityUUID: string;
  amEntityUUID: string;
  // Investment
  shareClassId?: string;
  shareClassFeeId?: string;
  committedAmount?: number;
  // Capital call
  callAmount: number;
  subscriptionDate?: number;
  entryFeeRateDecimal?: number;
  markDeployed?: boolean;
  currencyId?: number;
  fundId?: string;
}

type AssetRecord = {
  id: string;
  entity: string;
  asset_class?: number | null;
  investable?: string | null;
  currency?: number | null;
  cap_table_shareholder?: string | null;
  cap_table_entry?: string | null;
  fund?: string | null;
  name?: string | null;
};

// ─── POST /api/fund-company-subscription ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: CompanySubscriptionBody = await req.json();
  const {
    email,
    name,
    companyEntityUUID: providedCompanyEntityUUID,
    fundEntityUUID,
    amEntityUUID,
    shareClassId,
    shareClassFeeId,
    committedAmount,
    callAmount,
    subscriptionDate = Date.now(),
    entryFeeRateDecimal = 0,
    markDeployed = false,
    currencyId = 1,
    fundId,
  } = body;

  if (!name.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!callAmount || callAmount <= 0) return NextResponse.json({ error: "callAmount must be positive" }, { status: 400 });

  const base = process.env.PLATFORM_API_URL!;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const feeAmount = callAmount * (entryFeeRateDecimal ?? 0);
  const netForShares = callAmount;

  console.log(`[company-subscription] ▶ START — company="${name}" email="${email}" callAmount=${callAmount} fundEntity=${fundEntityUUID}`);

  // ── STEP 1: Find or create user (UBO behind the company) ──────────────────
  let userId: number | null = null;

  if (email?.trim()) {
    console.log(`[company-subscription] STEP 1 — checking email "${email}"`);
    const checkRes = await fetch(`${base}/user/check-email`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ email: email.trim() }),
    });
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json();
      if (checkData.exists && checkData.user?.id != null) {
        userId = checkData.user.id;
        console.log(`[company-subscription] STEP 1 — found existing user id=${userId}`);
      } else {
        const createUserRes = await fetch(`${base}/user`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        });
        if (createUserRes.ok) {
          const newUser: { id: number } = await createUserRes.json();
          userId = newUser.id;
          console.log(`[company-subscription] STEP 1 — created new user id=${userId}`);
        } else {
          console.warn(`[company-subscription] STEP 1 — failed to create user: ${await createUserRes.text()}`);
        }
      }
    } else {
      console.warn(`[company-subscription] STEP 1 — check-email failed`);
    }
  } else {
    console.log(`[company-subscription] STEP 1 — no email provided, userId remains null`);
  }

  // ── STEP 2: Find or create AM-level shareholder ────────────────────────────
  let amShareholderId: string | null = null;

  console.log(`[company-subscription] STEP 2 — resolving AM shareholder (entity=${amEntityUUID})`);
  if (email?.trim()) {
    const amShListRes = await fetch(`${base}/cap_table_shareholder?entity=${amEntityUUID}`, { headers: h, cache: "no-store" });
    if (amShListRes.ok) {
      const amList: Array<{ id: string; email?: string | null }> = await amShListRes.json();
      const existing = amList.find((s) => s.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        amShareholderId = existing.id;
        console.log(`[company-subscription] STEP 2 — found existing AM shareholder id=${amShareholderId}`);
      }
    }
  }

  if (!amShareholderId) {
    const createAmRes = await fetch(`${base}/cap_table_shareholder`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: amEntityUUID,
        name: name.trim(),
        email: email?.trim() || null,
        type: "company",
        role: "investor",
        ...(userId != null ? { user: userId } : {}),
      }),
    });
    if (!createAmRes.ok) {
      console.error(`[company-subscription] STEP 2 — failed to create AM shareholder: ${await createAmRes.text()}`);
      return NextResponse.json({ error: "Failed to create AM shareholder", detail: await createAmRes.text() }, { status: 500 });
    }
    const amSh: { id: string } = await createAmRes.json();
    amShareholderId = amSh.id;
    console.log(`[company-subscription] STEP 2 — created AM shareholder id=${amShareholderId}`);
  }

  // ── STEP 3: Create fund-level shareholder ─────────────────────────────────
  console.log(`[company-subscription] STEP 3 — creating fund shareholder (entity=${fundEntityUUID})`);
  const createFundShRes = await fetch(`${base}/cap_table_shareholder`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      name: name.trim(),
      email: email?.trim() || null,
      type: "company",
      role: "investor",
      ...(userId != null ? { user: userId } : {}),
    }),
  });
  if (!createFundShRes.ok) {
    console.error(`[company-subscription] STEP 3 — failed to create fund shareholder: ${await createFundShRes.text()}`);
    return NextResponse.json({ error: "Failed to create fund shareholder", detail: await createFundShRes.text() }, { status: 500 });
  }
  const fundSh: { id: string } = await createFundShRes.json();
  console.log(`[company-subscription] STEP 3 — created fund shareholder id=${fundSh.id}`);

  if (amShareholderId) {
    await fetch(`${base}/cap_table_shareholder/${fundSh.id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ parent_shareholder: amShareholderId }),
    });
    console.log(`[company-subscription] STEP 3 — linked fund shareholder to AM shareholder id=${amShareholderId}`);
  }

  // ── STEP 4: Cap table entry ────────────────────────────────────────────────
  console.log(`[company-subscription] STEP 4 — creating cap table entry (shareholder=${fundSh.id})`);
  const createEntryRes = await fetch(`${base}/cap_table_entry`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      shareholder: fundSh.id,
      share_class: shareClassId || null,
      committed_amount: committedAmount ?? null,
      currency: currencyId,
      issued_at: subscriptionDate,
    }),
  });
  if (!createEntryRes.ok) {
    console.error(`[company-subscription] STEP 4 — failed to create cap table entry: ${await createEntryRes.text()}`);
    return NextResponse.json({ error: "Failed to create cap table entry", detail: await createEntryRes.text() }, { status: 500 });
  }
  const entry: { id: string } = await createEntryRes.json();
  console.log(`[company-subscription] STEP 4 — created cap table entry id=${entry.id}`);

  // ── STEP 5: Capital call ───────────────────────────────────────────────────
  console.log(`[company-subscription] STEP 5 — creating capital call (amount=${callAmount}, status=paid)`);
  const createCallRes = await fetch(`${base}/capital_call`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      cap_table_entry: entry.id,
      amount: callAmount,
      called_at: subscriptionDate,
      status: "paid",
    }),
  });
  if (!createCallRes.ok) {
    console.error(`[company-subscription] STEP 5 — failed to create capital call: ${await createCallRes.text()}`);
    return NextResponse.json({ error: "Failed to create capital call", detail: await createCallRes.text() }, { status: 500 });
  }
  const call: { id: string } = await createCallRes.json();
  console.log(`[company-subscription] STEP 5 — created capital call id=${call.id}`);

  const callPatch: Record<string, unknown> = { called_at: subscriptionDate, received_at: subscriptionDate };
  if (shareClassId) callPatch.share_class = shareClassId;
  if (feeAmount > 0) {
    callPatch.fee_amount = feeAmount;
    if (shareClassFeeId) callPatch.share_class_fee = shareClassFeeId;
  }
  if (markDeployed) callPatch.deployed_at = subscriptionDate;
  await fetch(`${base}/capital_call/${call.id}`, { method: "PATCH", headers: h, body: JSON.stringify(callPatch) });
  console.log(`[company-subscription] STEP 5 — patched capital call dates (called_at, received_at${markDeployed ? ", deployed_at" : ""})`);

  // ── STEP 6: Fund cash asset ────────────────────────────────────────────────
  console.log(`[company-subscription] STEP 6 — resolving fund cash asset (entity=${fundEntityUUID}, currency=${currencyId})`);
  let fundCashAssetId: string | null = null;

  type FundRecord = { name?: string | null; country?: number | null };
  const fundName_country: FundRecord = fundId
    ? await fetch(`${base}/fund/${fundId}`, { headers: h, cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    : {};
  const fundName = fundName_country.name ?? null;
  const fundCountry = fundName_country.country ?? null;

  const fundAssetsRes = await fetch(`${base}/asset?entity=${fundEntityUUID}`, { headers: h, cache: "no-store" });
  if (fundAssetsRes.ok) {
    const fundAssets: AssetRecord[] = await fundAssetsRes.json();
    const cashAsset = fundAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId);
    if (cashAsset) {
      fundCashAssetId = cashAsset.id;
      console.log(`[company-subscription] STEP 6 — found existing fund cash asset id=${fundCashAssetId}`);
    }
  }

  if (!fundCashAssetId) {
    const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" });
    const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash";
    const createFundCashRes = await fetch(`${base}/asset`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: fundEntityUUID, asset_class: 1, name: currencyName, currency: currencyId,
        ...(fundCountry != null ? { country: fundCountry } : {}),
        investable: "investable_cash", locked: true,
      }),
    });
    if (createFundCashRes.ok) {
      fundCashAssetId = ((await createFundCashRes.json()) as { id: string }).id;
      console.log(`[company-subscription] STEP 6 — created fund cash asset id=${fundCashAssetId}`);
    } else {
      console.warn(`[company-subscription] STEP 6 — failed to create fund cash asset`);
    }
  }

  // ── STEP 7: Fund subscription transaction ─────────────────────────────────
  console.log(`[company-subscription] STEP 7 — recording fund subscription transaction`);
  let subscriptionTypeId: number | null = null;
  const ttRes = await fetch(`${base}/transaction_type`, { headers: h, cache: "no-store" });
  if (ttRes.ok) {
    const ttList: Array<{ id: number; name?: string }> = await ttRes.json();
    const sub = ttList.find((t) => t.name?.toLowerCase() === "subscription");
    const buy = ttList.find((t) => t.name?.toLowerCase() === "buy");
    subscriptionTypeId = sub?.id ?? buy?.id ?? null;
  }

  if (fundCashAssetId) {
    const fundTxRes = await fetch(`${base}/transaction`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ type: subscriptionTypeId, reference: `Subscription — ${name}`, created_by_entity: fundEntityUUID, date: subscriptionDate }),
    });
    if (fundTxRes.ok) {
      const fundTx: { id: string } = await fundTxRes.json();
      console.log(`[company-subscription] STEP 7 — created fund transaction id=${fundTx.id}, recording cash IN entry`);
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: fundTx.id, entity: fundEntityUUID,
          entry_type: "cash", object_type: "asset", object_id: fundCashAssetId,
          direction: "in", currency: currencyId, amount: netForShares,
          source: "cap", source_id: fundSh.id,
        }),
      });
    }
  }

  // ── STEP 8: Find or create UBO personal portfolio ─────────────────────────
  // Needed now so it's ready for the future UBO capital call flow.
  console.log(`[company-subscription] STEP 8 — resolving UBO personal portfolio (userId=${userId})`);
  let personalPortfolioEntityUUID: string | null = null;
  let portfolioSkipReason: string | null = null;

  if (userId != null) {
    const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ owner: userId }),
    });
    if (portfoliosRes.ok) {
      const portfolios: Array<{ id: string; entity: string }> = await portfoliosRes.json();
      if (portfolios.length > 0) {
        personalPortfolioEntityUUID = portfolios[0].entity;
        console.log(`[company-subscription] STEP 8 — found existing portfolio entity=${personalPortfolioEntityUUID}`);
      }
    }

    if (!personalPortfolioEntityUUID) {
      const newEntityRes = await fetch(`${base}/entity`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ type: "portfolio", owner: userId }),
      });
      if (newEntityRes.ok) {
        const newEntity: { id: string } = await newEntityRes.json();
        personalPortfolioEntityUUID = newEntity.id;
        console.log(`[company-subscription] STEP 8 — created portfolio entity=${personalPortfolioEntityUUID}`);
        await fetch(`${base}/portfolio`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            entity: newEntity.id,
            name: `${name.trim()} Portfolio`,
            currency: currencyId,
            inception_date: new Date("2020-01-01").getTime(),
          }),
        });
      } else {
        console.warn(`[company-subscription] STEP 8 — failed to create portfolio entity`);
      }
    }
  } else {
    portfolioSkipReason = "No user email provided — UBO personal portfolio not created";
    console.log(`[company-subscription] STEP 8 — skipped: ${portfolioSkipReason}`);
  }

  // ── STEP 9: Resolve company entity ────────────────────────────────────────
  // If the dialog already selected a specific company, use it directly.
  // Otherwise find-or-create via company/by-owner (name match → create).
  console.log(`[company-subscription] STEP 9 — resolving company entity (provided=${providedCompanyEntityUUID ?? "none"})`);
  let companyEntityUUID: string | null = providedCompanyEntityUUID ?? null;
  let companySkipReason: string | null = null;

  if (providedCompanyEntityUUID) {
    console.log(`[company-subscription] STEP 9 — using provided company entity=${providedCompanyEntityUUID}`);
  } else if (!companyEntityUUID) {
    if (userId != null) {
      const companyListRes = await fetch(`${base}/company/by-owner`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ owner: userId }),
      });
      if (companyListRes.ok) {
        const companies: Array<{ id: string; _company?: { name?: string | null } | null }> = await companyListRes.json();
        // Match by name; if UBO has only one company and no name match, use it
        const match =
          companies.find((c) => c._company?.name?.toLowerCase() === name.trim().toLowerCase()) ??
          (companies.length === 1 ? companies[0] : null);
        if (match) {
          companyEntityUUID = match.id;
          console.log(`[company-subscription] STEP 9 — matched existing company entity=${companyEntityUUID}`);
        }
      }

      if (!companyEntityUUID) {
        console.log(`[company-subscription] STEP 9 — no existing company found, creating new`);
        const newEntityRes = await fetch(`${base}/entity`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ type: "company", owner: userId }),
        });
        if (newEntityRes.ok) {
          const newEntity: { id: string } = await newEntityRes.json();
          companyEntityUUID = newEntity.id;
          console.log(`[company-subscription] STEP 9 — created company entity=${companyEntityUUID}`);
          await fetch(`${base}/company`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({ entity: newEntity.id, name: name.trim(), currency: currencyId, user_id: userId }),
          });
        } else {
          companySkipReason = "Failed to create company entity";
          console.error(`[company-subscription] STEP 9 — ${companySkipReason}`);
        }
      }
    } else {
      companySkipReason = "No user ID — cannot resolve company";
      console.log(`[company-subscription] STEP 9 — skipped: ${companySkipReason}`);
    }
  }

  // ── STEP 10: Company cash asset ────────────────────────────────────────────
  console.log(`[company-subscription] STEP 10 — resolving company cash asset (entity=${companyEntityUUID ?? "none"})`);
  let companyCashAssetId: string | null = null;

  if (companyEntityUUID) {
    const companyAssetsRes = await fetch(`${base}/asset?entity=${companyEntityUUID}`, { headers: h, cache: "no-store" });
    if (companyAssetsRes.ok) {
      const companyAssets: AssetRecord[] = await companyAssetsRes.json();
      const cashAsset = companyAssets.find((a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId);
      if (cashAsset) {
        companyCashAssetId = cashAsset.id;
        console.log(`[company-subscription] STEP 10 — found existing company cash asset id=${companyCashAssetId}`);
      }
    }

    if (!companyCashAssetId) {
      const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" });
      const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash";
      const createCashRes = await fetch(`${base}/asset`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          entity: companyEntityUUID, asset_class: 1, name: currencyName, currency: currencyId,
          investable: "investable_cash", locked: true,
        }),
      });
      if (createCashRes.ok) {
        companyCashAssetId = ((await createCashRes.json()) as { id: string }).id;
        console.log(`[company-subscription] STEP 10 — created company cash asset id=${companyCashAssetId}`);
      } else {
        console.warn(`[company-subscription] STEP 10 — failed to create company cash asset`);
      }
    }
  }

  // ── STEP 11: Fund equity stake asset in company ───────────────────────────
  // This represents the company's holding in the fund — value tracks via cap table NAV.
  console.log(`[company-subscription] STEP 11 — resolving fund equity stake in company (entity=${companyEntityUUID ?? "none"})`);
  let companyFundInvestmentAssetId: string | null = null;

  if (companyEntityUUID) {
    const companyAssetsRes = await fetch(`${base}/asset?entity=${companyEntityUUID}`, { headers: h, cache: "no-store" });
    if (companyAssetsRes.ok) {
      const companyAssets: AssetRecord[] = await companyAssetsRes.json();
      const existing =
        companyAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entry.id) ??
        companyAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundSh.id);
      if (existing) {
        companyFundInvestmentAssetId = existing.id;
        console.log(`[company-subscription] STEP 11 — found existing fund equity stake id=${companyFundInvestmentAssetId}`);
      }
    }

    if (!companyFundInvestmentAssetId) {
      const createInvRes = await fetch(`${base}/asset`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          entity: companyEntityUUID,
          name: fundName ?? "Fund Investment",
          asset_class: 3,
          currency: currencyId,
          ...(fundCountry != null ? { country: fundCountry } : {}),
          investable: "equity_stake",
          purchased_at: subscriptionDate,
          locked: true,
        }),
      });
      if (createInvRes.ok) {
        const fundInv: { id: string } = await createInvRes.json();
        companyFundInvestmentAssetId = fundInv.id;
        console.log(`[company-subscription] STEP 11 — created fund equity stake id=${companyFundInvestmentAssetId}`);
        // Link to cap table entry, shareholder, and fund for full traceability
        await fetch(`${base}/asset/${fundInv.id}`, {
          method: "PATCH",
          headers: h,
          body: JSON.stringify({
            cap_table_shareholder: fundSh.id,
            cap_table_entry: entry.id,
            ...(fundId ? { fund: fundId } : {}),
          }),
        });
      }
    }
  }

  // ── STEP 12: UBO capital call on the company ──────────────────────────────
  // UBO funds the company first; once company has cash, it then pays the fund.
  console.log(`[company-subscription] STEP 12 — UBO capital call (companyEntity=${companyEntityUUID ?? "none"}, userId=${userId})`)
  let uboShareholderId: string | null = null;
  let uboEntryId: string | null = null;
  let uboCallId: string | null = null;
  let uboSkipReason: string | null = null;

  if (companyEntityUUID && userId != null) {
    // Look up the UBO's shareholder record within the company entity
    const lookupRes = await fetch(`${base}/cap_table_shareholder/lookup`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ entity: companyEntityUUID, user_id: userId }),
    });

    if (lookupRes.ok) {
      const uboShareholder: { id: string } | null = await lookupRes.json().catch(() => null);
      if (uboShareholder?.id) {
        uboShareholderId = uboShareholder.id;
        console.log(`[company-subscription] STEP 12 — found UBO shareholder id=${uboShareholderId}`);

        // Create cap_table_entry on the company for the UBO shareholder
        const uboEntryRes = await fetch(`${base}/cap_table_entry`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            entity: companyEntityUUID,
            shareholder: uboShareholderId,
            committed_amount: callAmount,
            issued_at: subscriptionDate,
          }),
        });

        if (uboEntryRes.ok) {
          const uboEntry: { id: string } = await uboEntryRes.json();
          uboEntryId = uboEntry.id;
          console.log(`[company-subscription] STEP 12 — created UBO cap table entry id=${uboEntryId}`);

          // Create capital call as paid directly — migration flow, no notifications or tasks
          const uboCallRes = await fetch(`${base}/capital_call`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({
              entity: companyEntityUUID,
              cap_table_entry: uboEntry.id,
              amount: callAmount,
              called_at: subscriptionDate,
              status: "paid",
            }),
          });

          if (uboCallRes.ok) {
            const uboCall: { id: string } = await uboCallRes.json();
            uboCallId = uboCall.id;
            console.log(`[company-subscription] STEP 12 — created UBO capital call id=${uboCallId} (status=paid)`);

            await fetch(`${base}/capital_call/${uboCall.id}`, {
              method: "PATCH",
              headers: h,
              body: JSON.stringify({
                called_at: subscriptionDate,
                received_at: subscriptionDate,
                ...(markDeployed ? { deployed_at: subscriptionDate } : {}),
              }),
            });

            // Find cash asset + find/create company equity stake in personal portfolio,
            // then record: cash OUT → company equity IN
            if (personalPortfolioEntityUUID) {
              console.log(`[company-subscription] STEP 12 — resolving personal portfolio assets (entity=${personalPortfolioEntityUUID})`);
              const personalAssetsRes = await fetch(`${base}/asset?entity=${personalPortfolioEntityUUID}`, { headers: h, cache: "no-store" });
              if (personalAssetsRes.ok) {
                const personalAssets: AssetRecord[] = await personalAssetsRes.json();

                let personalCashAsset = personalAssets.find(
                  (a) => a.asset_class === 1 && a.investable === "investable_cash" && a.currency === currencyId
                );

                if (!personalCashAsset) {
                  console.log(`[company-subscription] STEP 12 — no personal cash asset found, creating one`);
                  const currencyRes = await fetch(`${base}/currency/${currencyId}`, { headers: h, cache: "no-store" });
                  const currencyName = currencyRes.ok ? (((await currencyRes.json()) as { name?: string | null }).name ?? "Cash") : "Cash";
                  const createPersonalCashRes = await fetch(`${base}/asset`, {
                    method: "POST",
                    headers: h,
                    body: JSON.stringify({
                      entity: personalPortfolioEntityUUID,
                      asset_class: 1,
                      name: currencyName,
                      currency: currencyId,
                      investable: "investable_cash",
                      locked: true,
                    }),
                  });
                  if (createPersonalCashRes.ok) {
                    personalCashAsset = await createPersonalCashRes.json();
                    console.log(`[company-subscription] STEP 12 — created personal cash asset id=${personalCashAsset?.id}`);
                  } else {
                    console.warn(`[company-subscription] STEP 12 — failed to create personal cash asset`);
                  }
                } else {
                  console.log(`[company-subscription] STEP 12 — found personal cash asset id=${personalCashAsset.id}`);
                }

                // Find existing company equity stake (matched by cap_table_entry or shareholder)
                let companyEquityAssetId: string | null =
                  personalAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === uboEntryId)?.id ??
                  personalAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === uboShareholderId)?.id ??
                  null;

                // Create if not found
                if (!companyEquityAssetId) {
                  const createEquityRes = await fetch(`${base}/asset`, {
                    method: "POST",
                    headers: h,
                    body: JSON.stringify({
                      entity: personalPortfolioEntityUUID,
                      name: name.trim(),
                      asset_class: 3,
                      currency: currencyId,
                      investable: "equity_stake",
                      purchased_at: subscriptionDate,
                      locked: true,
                    }),
                  });
                  if (createEquityRes.ok) {
                    const equityAsset: { id: string } = await createEquityRes.json();
                    companyEquityAssetId = equityAsset.id;
                    // Link to UBO's cap table entry and shareholder in the company
                    await fetch(`${base}/asset/${equityAsset.id}`, {
                      method: "PATCH",
                      headers: h,
                      body: JSON.stringify({
                        cap_table_shareholder: uboShareholderId,
                        cap_table_entry: uboEntryId,
                      }),
                    });
                  }
                }

                if (personalCashAsset && companyEquityAssetId) {
                  const grossWire = callAmount + feeAmount;

                  // ── Personal portfolio transaction (3 entries) ───────────────
                  console.log(`[company-subscription] STEP 12 — recording personal portfolio transaction (3 entries, grossWire=${grossWire})`);
                  const personalTxRes = await fetch(`${base}/transaction`, {
                    method: "POST",
                    headers: h,
                    body: JSON.stringify({
                      type: subscriptionTypeId,
                      reference: `${name.trim()} — company funding`,
                      created_by_entity: personalPortfolioEntityUUID,
                      date: subscriptionDate,
                    }),
                  });
                  if (personalTxRes.ok) {
                    const personalTx: { id: string } = await personalTxRes.json();
                    console.log(`[company-subscription] STEP 12 — created personal portfolio transaction id=${personalTx.id}`);

                    // Entry 1: New money IN — gross wire arrives in personal cash
                    await fetch(`${base}/transaction_entry`, {
                      method: "POST",
                      headers: h,
                      body: JSON.stringify({
                        transaction: personalTx.id, entity: personalPortfolioEntityUUID,
                        entry_type: "cash", object_type: "asset", object_id: personalCashAsset.id,
                        direction: "in", currency: currencyId, amount: grossWire,
                        source: "new_money_in",
                      }),
                    });

                    // Entry 2: Cash OUT — gross wire leaves personal cash to company
                    await fetch(`${base}/transaction_entry`, {
                      method: "POST",
                      headers: h,
                      body: JSON.stringify({
                        transaction: personalTx.id, entity: personalPortfolioEntityUUID,
                        entry_type: "cash", object_type: "asset", object_id: personalCashAsset.id,
                        direction: "out", currency: currencyId, amount: grossWire,
                        source: "asset", source_id: companyEquityAssetId,
                      }),
                    });

                    // Entry 3: Company equity IN — net amount added to equity stake
                    await fetch(`${base}/transaction_entry`, {
                      method: "POST",
                      headers: h,
                      body: JSON.stringify({
                        transaction: personalTx.id, entity: personalPortfolioEntityUUID,
                        entry_type: "equity", object_type: "asset", object_id: companyEquityAssetId,
                        direction: "in", currency: currencyId, amount: callAmount,
                        source: "cash", source_id: personalCashAsset.id,
                      }),
                    });
                  }

                  // ── Company cash IN — UBO funds the company ─────────────────
                  console.log(`[company-subscription] STEP 12 — recording company cash IN from UBO`);
                  if (companyCashAssetId) {
                    const companyCashInTxRes = await fetch(`${base}/transaction`, {
                      method: "POST",
                      headers: h,
                      body: JSON.stringify({
                        type: subscriptionTypeId,
                        reference: `UBO funding — ${name.trim()}`,
                        created_by_entity: companyEntityUUID,
                        date: subscriptionDate,
                      }),
                    });
                    if (companyCashInTxRes.ok) {
                      const companyCashInTx: { id: string } = await companyCashInTxRes.json();
                      console.log(`[company-subscription] STEP 12 — created company cash IN transaction id=${companyCashInTx.id}`);
                      await fetch(`${base}/transaction_entry`, {
                        method: "POST",
                        headers: h,
                        body: JSON.stringify({
                          transaction: companyCashInTx.id, entity: companyEntityUUID,
                          entry_type: "cash", object_type: "asset", object_id: companyCashAssetId,
                          direction: "in", currency: currencyId, amount: grossWire,
                          source: "cap", source_id: uboShareholderId,
                        }),
                      });
                    }
                  }
                }
              }
            }
          } else {
            uboSkipReason = "Failed to create UBO capital call";
            console.error(`[company-subscription] STEP 12 — ${uboSkipReason}`);
          }
        } else {
          uboSkipReason = "Failed to create UBO cap table entry";
          console.error(`[company-subscription] STEP 12 — ${uboSkipReason}`);
        }
      } else {
        uboSkipReason = "UBO shareholder not found in company";
        console.warn(`[company-subscription] STEP 12 — ${uboSkipReason}`);
      }
    } else {
      uboSkipReason = "Shareholder lookup failed";
      console.error(`[company-subscription] STEP 12 — ${uboSkipReason}`);
    }
  } else {
    uboSkipReason = companyEntityUUID ? "No user ID to look up UBO shareholder" : "Company entity not resolved";
    console.log(`[company-subscription] STEP 12 — skipped: ${uboSkipReason}`);
  }

  // ── STEP 13: Company pays fund — cash OUT + equity IN ─────────────────────
  // Recorded last so that company cash arrives from UBO before it leaves to the fund.
  console.log(`[company-subscription] STEP 13 — recording company → fund transaction (company entity=${companyEntityUUID ?? "none"})`);
  if (companyEntityUUID && companyCashAssetId && companyFundInvestmentAssetId) {
    const grossWire = callAmount + feeAmount;

    const companyTxRes = await fetch(`${base}/transaction`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        type: subscriptionTypeId,
        reference: `${fundName ?? "Fund"} subscription`,
        created_by_entity: companyEntityUUID,
        date: subscriptionDate,
      }),
    });

    if (companyTxRes.ok) {
      const companyTx: { id: string } = await companyTxRes.json();
      console.log(`[company-subscription] STEP 13 — created company transaction id=${companyTx.id} (cash OUT + equity IN)`);

      // Entry 1: Company cash OUT — gross wire leaves company to fund
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: companyTx.id, entity: companyEntityUUID,
          entry_type: "cash", object_type: "asset", object_id: companyCashAssetId,
          direction: "out", currency: currencyId, amount: grossWire,
          source: "asset", source_id: companyFundInvestmentAssetId,
        }),
      });

      // Entry 2: Fund equity IN — net amount deployed into fund equity stake
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: companyTx.id, entity: companyEntityUUID,
          entry_type: "equity", object_type: "asset", object_id: companyFundInvestmentAssetId,
          direction: "in", currency: currencyId, amount: netForShares,
          source: "cash", source_id: companyCashAssetId,
        }),
      });
    }
  } else {
    console.warn(`[company-subscription] STEP 13 — skipped (missing company=${companyEntityUUID ?? "none"}, cash=${companyCashAssetId ?? "none"}, equity=${companyFundInvestmentAssetId ?? "none"})`);
  }

  console.log(`[company-subscription] ✓ DONE — userId=${userId} fundShareholder=${fundSh.id} entry=${entry.id} call=${call.id} company=${companyEntityUUID} uboCall=${uboCallId ?? "skipped"}`);

  return NextResponse.json({
    success: true,
    userId,
    amShareholderId,
    fundShareholderId: fundSh.id,
    entryId: entry.id,
    callId: call.id,
    personalPortfolioEntityUUID,
    companyEntityUUID,
    companyCashAssetId,
    companyFundInvestmentAssetId,
    uboShareholderId,
    uboEntryId,
    uboCallId,
    uboSkipReason,
    portfolioSkipReason,
    companySkipReason,
  });
}
