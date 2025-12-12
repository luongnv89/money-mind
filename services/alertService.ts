
import { Transaction, TransactionCategory } from '../types';

interface Alert {
    id: string;
    message: string;
    type: 'warning' | 'info';
}

const FUNNY_TEMPLATES: Record<string, string[]> = {
    [TransactionCategory.NiceToHave]: [
        "Your wallet is whispering 'please stop'.",
        "Whoa, easy there big spender!",
        "Retail therapy is getting expensive.",
        "That's a lot of treats. The budget is trembling.",
        "Did you buy front-row tickets? This category is heating up!"
    ],
    "Dining Out": [
        "Whoa, your fork's on strike till next month—microwave ramen's calling!",
        "The kitchen misses you. Just saying.",
        "Chef Mike (the microwave) is feeling neglected.",
        "Sneaky snacking alert! Your dining budget is full."
    ],
    "Coffee": [
        "Caffeine high, bank account low.",
        "Sneaky coffee habit alert—your wallet is crying.",
        "At this rate, you're personally funding the barista's retirement."
    ],
    [TransactionCategory.Waste]: [
        "Money burner detected! 💸",
        "This category is the black hole of your finances.",
        "Oops! Fees and waste are creeping up."
    ],
    "Generic": [
        "Budget drift detected! Captain, we're off course.",
        "Spending spike alert! Did you win the lottery?",
        "Math says: 'Ouch'. Current spending is high.",
        "Your bank account just coughed politely."
    ]
};

const getRandomQuip = (category: string, subCategory?: string): string => {
    let templates = FUNNY_TEMPLATES['Generic'];

    if (subCategory && (subCategory.includes('Dining') || subCategory.includes('Restaurant'))) {
        templates = FUNNY_TEMPLATES['Dining Out'];
    } else if (subCategory && (subCategory.includes('Coffee') || subCategory.includes('Starbucks'))) {
        templates = FUNNY_TEMPLATES['Coffee'];
    } else if (FUNNY_TEMPLATES[category]) {
        templates = FUNNY_TEMPLATES[category];
    }

    return templates[Math.floor(Math.random() * templates.length)];
};

export const checkFinancialHealth = (transactions: Transaction[]): Alert[] => {
    const alerts: Alert[] = [];
    
    // 1. Filter relevant expenses (ignore income/transfers)
    const expenses = transactions.filter(t => 
        t.amount < 0 && 
        t.category !== TransactionCategory.InternalTransfer &&
        t.category !== TransactionCategory.Income
    );

    if (expenses.length < 10) return []; // Not enough data

    // 2. Identify Current Month
    const dates = expenses.map(t => t.date).sort();
    const lastDate = dates[dates.length - 1];
    if (!lastDate) return [];
    
    const currentMonthKey = lastDate.substring(0, 7); // YYYY-MM

    // 3. Calculate Averages vs Current
    const groupedData: Record<string, { current: number, history: number, months: Set<string> }> = {};

    expenses.forEach(t => {
        const month = t.date.substring(0, 7);
        const catKey = t.category; // Analyze by Main Category
        
        if (!groupedData[catKey]) groupedData[catKey] = { current: 0, history: 0, months: new Set() };
        
        const amount = Math.abs(t.amount);

        if (month === currentMonthKey) {
            groupedData[catKey].current += amount;
        } else {
            groupedData[catKey].history += amount;
            groupedData[catKey].months.add(month);
        }
    });

    // 4. Analyze Drifts
    Object.entries(groupedData).forEach(([cat, data]) => {
        const historyMonths = data.months.size;
        if (historyMonths === 0) return;

        const average = data.history / historyMonths;
        const current = data.current;

        // Skip small amounts to avoid nagging about $5 vs $2
        if (average < 50) return; 

        // RULE: Significant Drift (> 20% over average)
        if (current > average * 1.2) {
            const quip = getRandomQuip(cat);
            const pct = Math.round(((current - average) / average) * 100);
            
            alerts.push({
                id: `drift-${cat}-${currentMonthKey}`,
                type: 'warning',
                message: `${cat} is up ${pct}%! ${quip}`
            });
        }
    });

    // Return only top 2 priority alerts to avoid spamming
    return alerts.sort((a, b) => b.message.length - a.message.length).slice(0, 2);
};
