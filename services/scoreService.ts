
import { Transaction, TransactionCategory } from '../types';

export interface ScoreBreakdown {
    label: string;
    points: number; // positive or negative
    reason: string;
    type: 'positive' | 'negative' | 'neutral';
}

export interface FinancialScore {
    score: number;
    grade: string; // "A+", "B", etc.
    breakdown: ScoreBreakdown[];
    tips: string[];
    hasEnoughData: boolean;
}

export const calculateFinancialScore = (allTransactions: Transaction[]): FinancialScore => {
    // 1. Validation: Need at least some expense data
    const expenses = allTransactions.filter(t => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer);
    if (expenses.length < 5) {
        return { score: 0, grade: '-', breakdown: [], tips: ["Add more transactions to generate a score."], hasEnoughData: false };
    }

    // 2. Setup Timeframes (Current Month vs History)
    const sortedTx = expenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestDate = new Date(sortedTx[sortedTx.length - 1].date);
    const currentMonthKey = latestDate.toISOString().substring(0, 7); // YYYY-MM
    
    const currentMonthTx = expenses.filter(t => t.date.startsWith(currentMonthKey));
    const historyTx = expenses.filter(t => !t.date.startsWith(currentMonthKey));
    
    // If this is the very first month, we can't compare history well, but we can score based on composition.
    const isFirstMonth = historyTx.length === 0;

    let score = 100;
    const breakdown: ScoreBreakdown[] = [];
    const tips: string[] = [];

    // --- METRIC 1: Waste Control (Max Penalty: -20) ---
    const currentWaste = currentMonthTx
        .filter(t => t.category === TransactionCategory.Waste)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const totalCurrentSpend = currentMonthTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    if (totalCurrentSpend > 0) {
        const wasteRatio = currentWaste / totalCurrentSpend;
        if (wasteRatio > 0) {
            const penalty = Math.min(20, Math.ceil(wasteRatio * 100)); // 1% waste = 1 point penalty
            score -= penalty;
            breakdown.push({
                label: 'Waste / Fees',
                points: -penalty,
                reason: `${(wasteRatio * 100).toFixed(1)}% of spending is waste`,
                type: 'negative'
            });
            tips.push("Review 'Waste' items. Cutting fees is the easiest way to boost your score.");
        } else {
             breakdown.push({ label: 'Efficiency', points: 0, reason: 'No waste detected', type: 'positive' });
        }
    }

    // --- METRIC 2: Budget Adherence (Current vs Avg) ---
    // Skip if first month
    if (!isFirstMonth) {
        // Calculate average monthly spend from history
        const uniqueHistoryMonths = new Set(historyTx.map(t => t.date.substring(0, 7))).size || 1;
        const totalHistorySpend = historyTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const avgMonthlySpend = totalHistorySpend / uniqueHistoryMonths;

        if (avgMonthlySpend > 0) {
            const drift = totalCurrentSpend - avgMonthlySpend;
            const driftPercent = (drift / avgMonthlySpend) * 100;

            if (driftPercent > 0) {
                // Over budget
                // Penalty: 1 point for every 2% over, max 30
                const penalty = Math.min(30, Math.ceil(driftPercent / 2));
                score -= penalty;
                breakdown.push({
                    label: 'Overall Budget',
                    points: -penalty,
                    reason: `${Math.round(driftPercent)}% over average`,
                    type: 'negative'
                });
                tips.push("You're spending more than usual this month. Check 'Nice-to-Have' categories.");
            } else {
                // Under budget bonus (max 10)
                const bonus = Math.min(10, Math.ceil(Math.abs(driftPercent) / 5));
                // We don't add to score (cap at 100), but we show positive reinforcement
                // Actually, let's treat 100 as "Perfect adherence". If we lost points elsewhere, this can redeem them.
                if (score < 100) {
                    const redeemable = 100 - score;
                    const actualBonus = Math.min(bonus, redeemable);
                    score += actualBonus;
                    breakdown.push({
                        label: 'Budget Control',
                        points: actualBonus,
                        reason: `${Math.round(Math.abs(driftPercent))}% under average`,
                        type: 'positive'
                    });
                }
            }
        }

        // --- METRIC 3: Nice-to-Have Drift ---
        const niceToHaveAvg = historyTx.filter(t => t.category === TransactionCategory.NiceToHave).reduce((sum, t) => sum + Math.abs(t.amount), 0) / uniqueHistoryMonths;
        const niceToHaveCurrent = currentMonthTx.filter(t => t.category === TransactionCategory.NiceToHave).reduce((sum, t) => sum + Math.abs(t.amount), 0);

        if (niceToHaveAvg > 50 && niceToHaveCurrent > niceToHaveAvg) {
             const driftPct = ((niceToHaveCurrent - niceToHaveAvg) / niceToHaveAvg) * 100;
             const penalty = Math.min(20, Math.ceil(driftPct / 5)); // 5% over = 1 point
             score -= penalty;
             breakdown.push({
                 label: 'Lifestyle Inflation',
                 points: -penalty,
                 reason: `Nice-to-haves up ${Math.round(driftPct)}%`,
                 type: 'negative'
             });
             tips.push(`Cut back on Nice-to-Haves by $${Math.round((niceToHaveCurrent - niceToHaveAvg)/4)} per week to get back on track.`);
        }
    } else {
        // First month heuristics
        breakdown.push({ label: 'History', points: 0, reason: 'Building history...', type: 'neutral' });
    }

    // --- METRIC 4: Savings/Investments (Bonus) ---
    const income = allTransactions
        .filter(t => t.category === TransactionCategory.Income && t.date.startsWith(currentMonthKey))
        .reduce((sum, t) => sum + t.amount, 0);

    const savings = currentMonthTx
        .filter(t => t.category === TransactionCategory.Save || t.category === TransactionCategory.Invest)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    if (income > 0) {
        const saveRate = savings / income;
        if (saveRate > 0.20) {
            breakdown.push({ label: 'Super Saver', points: 0, reason: '20%+ savings rate!', type: 'positive' });
            // Bonus points if we aren't at 100
            if (score < 100) score = Math.min(100, score + 5);
        } else if (saveRate < 0.05) {
             // Slight penalty for low savings if income exists
             score -= 5;
             breakdown.push({ label: 'Savings', points: -5, reason: 'Low savings rate', type: 'negative' });
             tips.push("Try to stash away at least 5-10% of income into Savings.");
        }
    }

    // Ensure range 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine Grade
    let grade = 'F';
    if (score >= 97) grade = 'A+';
    else if (score >= 93) grade = 'A';
    else if (score >= 90) grade = 'A-';
    else if (score >= 87) grade = 'B+';
    else if (score >= 83) grade = 'B';
    else if (score >= 80) grade = 'B-';
    else if (score >= 77) grade = 'C+';
    else if (score >= 73) grade = 'C';
    else if (score >= 70) grade = 'C-';
    else if (score >= 60) grade = 'D';

    // Default tip if none
    if (tips.length === 0) {
        if (score > 90) tips.push("You're crushing it! Consider increasing your investment contributions.");
        else tips.push("Maintain your current spending habits to improve your score.");
    }

    return { score, grade, breakdown, tips, hasEnoughData: true };
};
