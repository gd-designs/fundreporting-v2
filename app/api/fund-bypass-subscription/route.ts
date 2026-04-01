import { getAuthToken } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BypassSubscriptionBody {
  // Investor
  email?: string;
  name: string;
  type?: "individual" | "company";
  // Context
  fundEntityUUID: string; // entity UUID of the fund
  amEntityUUID: string; // entity UUID of the asset manager
  // Investment
  shareClassId?: string;
  shareClassFeeId?: string; // entry fee record id (for capital call patch)
  committedAmount?: number;
  // Capital call
  callAmount: number;
  subscriptionDate?: number; // ms timestamp — defaults to now
  entryFeeRateDecimal?: number; // e.g. 0.02 for 2%
  markDeployed?: boolean;
  currencyId?: number; // Xano currency ID (int) — defaults to 1 (EUR)
  fundId?: string; // fund table UUID — used to fetch fund name/country
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

// ─── POST /api/fund-bypass-subscription ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getAuthToken();
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: BypassSubscriptionBody = await req.json();
  const {
    email,
    name,
    type = "individual",
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

  if (!name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!callAmount || callAmount <= 0)
    return NextResponse.json(
      { error: "callAmount is required" },
      { status: 400 },
    );

  const base = process.env.PLATFORM_API_URL!;
  const h = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // callAmount = net for shares (what goes into the fund)
  // feeAmount  = additive entry fee on top (gross wire = callAmount + feeAmount)
  const feeAmount = callAmount * (entryFeeRateDecimal ?? 0);
  const netForShares = callAmount;

  // ── STEP 1: Find or create user ────────────────────────────────────────────
  let userId: number | null = null;

  if (email?.trim()) {
    const checkRes = await fetch(`${base}/user/check-email`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ email: email.trim() }),
    });
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } =
        await checkRes.json();
      if (checkData.exists && checkData.user?.id != null) {
        userId = checkData.user.id;
      } else {
        // Create passwordless user via Application group (no password — invite system handles login)
        const createUserRes = await fetch(`${base}/user`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        });
        if (createUserRes.ok) {
          const newUser: { id: number } = await createUserRes.json();
          userId = newUser.id;
        }
      }
    }
  }

  // ── STEP 2: Find or create AM-level shareholder ────────────────────────────
  let amShareholderId: string | null = null;

  if (email?.trim()) {
    const amShListRes = await fetch(
      `${base}/cap_table_shareholder?entity=${amEntityUUID}`,
      {
        headers: h,
        cache: "no-store",
      },
    );
    if (amShListRes.ok) {
      const amList: Array<{ id: string; email?: string | null }> =
        await amShListRes.json();
      const existing = amList.find(
        (s) => s.email?.toLowerCase() === email.toLowerCase(),
      );
      if (existing) amShareholderId = existing.id;
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
        type,
        role: "investor",
        ...(userId != null ? { user: userId } : {}),
      }),
    });
    if (!createAmRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create AM shareholder",
          detail: await createAmRes.text(),
        },
        { status: 500 },
      );
    }
    const amSh: { id: string } = await createAmRes.json();
    amShareholderId = amSh.id;
  }

  // ── STEP 3: Create fund-level shareholder + link to AM shareholder ─────────
  const createFundShRes = await fetch(`${base}/cap_table_shareholder`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      name: name.trim(),
      email: email?.trim() || null,
      type,
      role: "investor",
      ...(userId != null ? { user: userId } : {}),
    }),
  });
  if (!createFundShRes.ok) {
    return NextResponse.json(
      {
        error: "Failed to create fund shareholder",
        detail: await createFundShRes.text(),
      },
      { status: 500 },
    );
  }
  const fundSh: { id: string } = await createFundShRes.json();

  // Link fund → AM via parent_shareholder
  if (amShareholderId) {
    await fetch(`${base}/cap_table_shareholder/${fundSh.id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ parent_shareholder: amShareholderId }),
    });
  }

  // ── STEP 4: Create cap table entry ────────────────────────────────────────
  const createEntryRes = await fetch(`${base}/cap_table_entry`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      entity: fundEntityUUID,
      shareholder: fundSh.id,
      share_class: shareClassId || null,
      committed_amount: committedAmount ?? null,
      issued_at: subscriptionDate,
    }),
  });
  if (!createEntryRes.ok) {
    return NextResponse.json(
      {
        error: "Failed to create cap table entry",
        detail: await createEntryRes.text(),
      },
      { status: 500 },
    );
  }
  const entry: { id: string } = await createEntryRes.json();

  // ── STEP 5: Capital call (bypass — no notifications) ──────────────────────
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
    return NextResponse.json(
      {
        error: "Failed to create capital call",
        detail: await createCallRes.text(),
      },
      { status: 500 },
    );
  }
  const call: { id: string } = await createCallRes.json();

  // PATCH extra capital call fields (called_at repeated in case POST ignored it)
  const callPatch: Record<string, unknown> = { called_at: subscriptionDate, received_at: subscriptionDate };
  if (shareClassId) callPatch.share_class = shareClassId;
  if (feeAmount > 0) {
    callPatch.fee_amount = feeAmount;
    if (shareClassFeeId) callPatch.share_class_fee = shareClassFeeId;
  }
  if (markDeployed) callPatch.deployed_at = subscriptionDate;

  await fetch(`${base}/capital_call/${call.id}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify(callPatch),
  });

  // ── STEP 6: Ensure fund has a cash asset ──────────────────────────────────
  let fundCashAssetId: string | null = null;

  // Fetch fund record directly — name used in step 9, country used for cash asset
  type FundRecord = { name?: string | null; country?: number | null };
  const fundName_country: FundRecord =
    fundId
      ? await fetch(`${base}/fund/${fundId}`, { headers: h, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}))
      : {};
  const fundName = fundName_country.name ?? null;
  const fundCountry = fundName_country.country ?? null;

  const fundAssetsRes = await fetch(`${base}/asset?entity=${fundEntityUUID}`, {
    headers: h,
    cache: "no-store",
  });
  if (fundAssetsRes.ok) {
    const fundAssets: AssetRecord[] = await fundAssetsRes.json();
    const cashAsset = fundAssets.find(
      (a) =>
        a.asset_class === 1 &&
        a.investable === "investable_cash" &&
        a.currency === currencyId,
    );
    if (cashAsset) fundCashAssetId = cashAsset.id;
  }

  if (!fundCashAssetId) {
    const currencyRes = await fetch(`${base}/currency/${currencyId}`, {
      headers: h,
      cache: "no-store",
    });
    const currencyName = currencyRes.ok
      ? (((await currencyRes.json()) as { name?: string | null }).name ??
        "Cash")
      : "Cash";

    const createFundCashRes = await fetch(`${base}/asset`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        entity: fundEntityUUID,
        asset_class: 1,
        name: currencyName,
        currency: currencyId,
        ...(fundCountry != null ? { country: fundCountry } : {}),
        investable: "investable_cash",
        locked: true,
      }),
    });
    if (createFundCashRes.ok) {
      const cashAsset: { id: string } = await createFundCashRes.json();
      fundCashAssetId = cashAsset.id;
    }
  }

  // ── STEP 7: Fund transaction (subscription cash inflow) ───────────────────
  // Fetch transaction types once — reused for both fund and investor transactions
  let subscriptionTypeId: number | null = null;
  const ttRes = await fetch(`${base}/transaction_type`, {
    headers: h,
    cache: "no-store",
  });
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
      body: JSON.stringify({
        type: subscriptionTypeId,
        reference: `Subscription — ${name}`,
        created_by_entity: fundEntityUUID,
        date: subscriptionDate,
      }),
    });
    if (fundTxRes.ok) {
      const fundTx: { id: string } = await fundTxRes.json();
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: fundTx.id,
          entity: fundEntityUUID,
          entry_type: "cash",
          object_type: "asset",
          object_id: fundCashAssetId,
          direction: "in",
          currency: currencyId,
          amount: netForShares,
          source: "cap",
          source_id: fundSh.id,
        }),
      });
    }
  }

  // ── STEP 8: Find or create investor portfolio ──────────────────────────────
  let investorPortfolioEntityUUID: string | null = null;
  let investorCashAssetId: string | null = null;

  if (userId != null) {
    const portfoliosRes = await fetch(`${base}/portfolio/by-owner`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ owner: userId }),
    });
    if (portfoliosRes.ok) {
      const portfolios: Array<{ id: string; entity: string }> =
        await portfoliosRes.json();
      if (portfolios.length > 0)
        investorPortfolioEntityUUID = portfolios[0].entity;
    }

    if (!investorPortfolioEntityUUID) {
      // Create entity (type = portfolio, owner = userId)
      const newEntityRes = await fetch(`${base}/entity`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ type: "portfolio", owner: userId }),
      });
      if (newEntityRes.ok) {
        const newEntity: { id: string } = await newEntityRes.json();
        investorPortfolioEntityUUID = newEntity.id;

        // Portfolio POST now returns { portfolio, cash_asset } — grab cash asset ID directly
        const portfolioRes = await fetch(`${base}/portfolio`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            entity: newEntity.id,
            name: `${name.trim()} Portfolio`,
            currency: currencyId,
            inception_date: new Date("2020-01-01").getTime(),
          }),
        });
        if (portfolioRes.ok) {
          const portfolioData: {
            portfolio: { id: string };
            cash_asset: { id: string };
          } = await portfolioRes.json();
          investorCashAssetId = portfolioData.cash_asset?.id ?? null;
        }
      }
    }
  }

  // ── STEP 9: Investor portfolio assets ─────────────────────────────────────
  let fundInvestmentAssetId: string | null = null;

  if (investorPortfolioEntityUUID) {
    // GET all assets for the investor's portfolio — needed to find equity_stake for this fund,
    // and to find cash asset if this is an existing portfolio (new ones already have investorCashAssetId)
    const invAssetsRes = await fetch(
      `${base}/asset?entity=${investorPortfolioEntityUUID}`,
      {
        headers: h,
        cache: "no-store",
      },
    );
    if (invAssetsRes.ok) {
      const invAssets: AssetRecord[] = await invAssetsRes.json();
      if (!investorCashAssetId) {
        const cashAsset = invAssets.find(
          (a) =>
            a.asset_class === 1 &&
            a.investable === "investable_cash" &&
            a.currency === currencyId,
        );
        if (cashAsset) investorCashAssetId = cashAsset.id;
      }
      // Prefer lookup by entry (most precise), fall back to shareholder
      const fundInvAsset =
        invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_entry === entry.id) ??
        invAssets.find((a) => a.investable === "equity_stake" && a.cap_table_shareholder === fundSh.id)
      if (fundInvAsset) fundInvestmentAssetId = fundInvAsset.id;
    }

    // Create fund investment asset if not found
    if (!fundInvestmentAssetId) {
      const createFundInvRes = await fetch(`${base}/asset`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          entity: investorPortfolioEntityUUID,
          name: fundName ?? "Fund Investment",
          asset_class: 3,
          currency: currencyId,
          ...(fundCountry != null ? { country: fundCountry } : {}),
          investable: "equity_stake",
          purchased_at: subscriptionDate,
          locked: true,
        }),
      });
      if (createFundInvRes.ok) {
        const fundInv: { id: string } = await createFundInvRes.json();
        fundInvestmentAssetId = fundInv.id;

        // Link asset to entry, shareholder, and fund for full traceability
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

  // ── STEP 10: Investor buy transaction (3 entries) ─────────────────────────
  // NOTE: We deliberately do NOT calculate or record units (shares) here.
  // Shares are only created when a subscription mutation is processed at period open,
  // using the actual NAV at that time.
  if (
    investorPortfolioEntityUUID &&
    investorCashAssetId &&
    fundInvestmentAssetId
  ) {

    const invTxRes = await fetch(`${base}/transaction`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        type: subscriptionTypeId,
        reference: `${fundName ?? "Fund"} subscription`,
        created_by_entity: investorPortfolioEntityUUID,
        date: subscriptionDate,
      }),
    });

    if (invTxRes.ok) {
      const invTx: { id: string } = await invTxRes.json();

      // Gross wire = net for shares + entry fee (what investor actually wired)
      const grossWire = callAmount + feeAmount;

      // Entry 1: New money in — gross wire arrives in portfolio
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id,
          entity: investorPortfolioEntityUUID,
          entry_type: "cash",
          object_type: "asset",
          object_id: investorCashAssetId,
          direction: "in",
          currency: currencyId,
          amount: grossWire,
          source: "new_money_in",
        }),
      });

      // Entry 2: Capital call — gross wire leaves (net + fee) as fund investment
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id,
          entity: investorPortfolioEntityUUID,
          entry_type: "cash",
          object_type: "asset",
          object_id: investorCashAssetId,
          direction: "out",
          currency: currencyId,
          amount: grossWire,
          source: "asset",
          source_id: fundInvestmentAssetId,
        }),
      });

      // Entry 3: Fund investment asset in — net amount deployed into fund
      await fetch(`${base}/transaction_entry`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          transaction: invTx.id,
          entity: investorPortfolioEntityUUID,
          entry_type: "equity",
          object_type: "asset",
          object_id: fundInvestmentAssetId,
          direction: "in",
          currency: currencyId,
          amount: netForShares,
          source: "cash",
          source_id: investorCashAssetId,
        }),
      });
    }
  }

  return NextResponse.json({
    success: true,
    userId,
    amShareholderId,
    fundShareholderId: fundSh.id,
    entryId: entry.id,
    callId: call.id,
    investorPortfolioEntityUUID,
    investorCashAssetId,
    fundInvestmentAssetId,
    _debug: { fundId, fundName, fundCountry },
  });
}
