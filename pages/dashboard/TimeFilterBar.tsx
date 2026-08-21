import React from 'react';
import { Calendar, LayoutDashboard, List } from 'lucide-react';
import { cn } from '../../lib/utils';

export type TimeRange = 'week' | 'month' | 'all';
export type TabView = 'insights' | 'transactions';

export interface TimeFilterBarProps {
  timeRange: TimeRange;
  dateRangeDisplay: string;
  onTimeRangeChange: (range: TimeRange) => void;
}

/** "Viewing: <range> (<date span>)" label plus Week/Month/All Time toggle. */
export const TimeFilterBar: React.FC<TimeFilterBarProps> = ({
  timeRange,
  dateRangeDisplay,
  onTimeRangeChange,
}) => (
  <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
      <Calendar className="w-4 h-4 text-gray-400" />
      <span>
        Viewing:
        <span className="text-gray-900 ml-1">
          {timeRange === 'week'
            ? 'Last 7 Days'
            : timeRange === 'month'
              ? 'Last 30 Days'
              : 'All History'}
        </span>
        {dateRangeDisplay && (
          <span className="text-gray-500 font-normal text-xs ml-2">({dateRangeDisplay})</span>
        )}
      </span>
    </div>
    <div className="flex bg-gray-100 p-1 rounded-lg">
      {['Week', 'Month', 'All Time'].map((label) => {
        const value = label.toLowerCase().replace(' time', '') as TimeRange;
        const isActive = timeRange === value;
        return (
          <button
            key={label}
            onClick={() => onTimeRangeChange(value)}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-all',
              isActive ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  </div>
);

export interface DashboardTabsProps {
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
}

/** Insights / Transactions tab switcher. */
export const DashboardTabs: React.FC<DashboardTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabView; label: string; icon: React.ReactNode }[] = [
    { id: 'insights', label: 'Insights', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'transactions', label: 'Transactions', icon: <List className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-6 border-b border-gray-200 mt-2">
      {tabs.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-2 pb-3 text-sm font-medium transition-all border-b-2 px-1',
            activeTab === id
              ? 'border-accent text-accent'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
};
