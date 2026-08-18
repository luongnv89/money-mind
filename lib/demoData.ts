import { v4 as uuidv4 } from 'uuid';
import { Transaction, TransactionCategory } from '../types';
import { normalizeDate } from './utils';

export const getDemoTransactions = (): Transaction[] => {
  const today = new Date();
  const transactions: Transaction[] = [];

  // Helper to create transactions relative to today
  const addTx = (daysAgo: number, desc: string, amount: number, originalCat?: string) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);

    // Skip future dates if logic produces them (though subtracting daysAgo shouldn't)
    if (date > new Date()) return;

    transactions.push({
      id: uuidv4(),
      date: normalizeDate(date.toISOString().split('T')[0]),
      description: desc,
      amount: parseFloat(amount.toFixed(2)),
      category: TransactionCategory.Uncategorized,
      subCategory: undefined,
      originalCategory: originalCat,
      confidence: 0,
      isLearned: false,
      isApproved: false,
      reason: 'Demo Data',
      raw: {},
    });
  };

  // --- Recurring Monthly (3 Months) ---
  for (let i = 0; i < 3; i++) {
    const baseDay = i * 30;

    // Fixed Expenses
    addTx(baseDay + 1, 'LANDLORD RENT PAYMENT', -1400.0, 'Rent');
    addTx(baseDay + 3, 'VERIZON WIRELESS', -85.0, 'Bills');
    addTx(baseDay + 5, 'STATE FARM INSURANCE', -62.5, 'Insurance');
    addTx(baseDay + 28, 'COMCAST INTERNET', -79.99, 'Bills');

    // Variable Monthly Utilities
    addTx(baseDay + 15, 'CITY UTILITIES WATER', -45.0 - Math.random() * 15, 'Utilities');
    addTx(baseDay + 20, 'PG&E ELECTRIC', -50.0 - Math.random() * 30, 'Utilities');

    // Subscriptions
    addTx(baseDay + 5, 'NETFLIX.COM', -15.99, 'Subscription');
    addTx(baseDay + 7, 'SPOTIFY USA', -11.99, 'Subscription');
    addTx(baseDay + 22, 'APPLE SERVICES', -2.99, 'Subscription');

    // Occasional Shopping
    addTx(
      baseDay + 10 + Math.floor(Math.random() * 5),
      'AMZN Mktp US*1A2B3C',
      -25.0 - Math.random() * 50,
      'Shopping'
    );
  }

  // --- Bi-Weekly Income (Covering ~90 days) ---
  for (let i = 0; i < 7; i++) {
    const day = i * 14 + 2;
    if (day > 90) break;
    addTx(day, 'GUSTO PAYROLL 123456', 2850.0, 'Income');
  }

  // --- Weekly Groceries ---
  const groceryStores = [
    'TRADER JOES #123',
    'WHOLE FOODS MARKET',
    'SAFEWAY 2342',
    'COSTCO WHOLESALE',
    'LOCAL FARMERS MARKET',
  ];
  for (let i = 0; i < 13; i++) {
    const day = i * 7 + Math.floor(Math.random() * 3);
    if (day > 90) break;

    const store = groceryStores[i % groceryStores.length];
    // Costco usually more expensive
    const baseAmount = store.includes('COSTCO') ? 150 : 45;
    const amount = -baseAmount - Math.random() * 50;

    addTx(day, store, amount, 'Groceries');
  }

  // --- Periodic Transport ---
  for (let i = 0; i < 90; i += 10) {
    // Gas roughly every 10 days
    addTx(i + Math.floor(Math.random() * 3), 'CHEVRON 00234', -45.0 - Math.random() * 15, 'Gas');

    // Rideshare occasionally
    if (Math.random() > 0.5) {
      addTx(i + 5, 'UBER TRIP 23424', -15.0 - Math.random() * 20, 'Travel');
    }
  }

  // --- Daily/Random Spending (Coffee, Dining) ---
  const coffeeShops = ['STARBUCKS STORE 12342', 'BLUE BOTTLE COFFEE', 'PEETS COFFEE', 'LOCAL CAFE'];
  const diningPlaces = [
    'CHIPOTLE ONLINE',
    'UBER EATS',
    'DOORDASH*MCDONALDS',
    'LOCAL DINER 55',
    'SWEETGREEN',
    'SHAKE SHACK',
  ];

  for (let i = 0; i < 90; i++) {
    // Skip some days completely
    if (Math.random() > 0.6) continue;

    // Morning Coffee (40% chance on active days)
    if (Math.random() > 0.6) {
      const shop = coffeeShops[Math.floor(Math.random() * coffeeShops.length)];
      addTx(i, shop, -5.5 - Math.random() * 3, 'Dining');
    }

    // Lunch/Dinner (30% chance on active days)
    if (Math.random() > 0.7) {
      const place = diningPlaces[Math.floor(Math.random() * diningPlaces.length)];
      addTx(i, place, -15.0 - Math.random() * 35, 'Dining');
    }
  }

  // Sort by date descending (newest first)
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
