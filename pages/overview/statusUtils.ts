import { ComponentStatus } from '../../lib/finance';

/** Engine status → Badge variant. Status text is always shown, never color alone. */
export const statusVariant = (status: ComponentStatus): 'positive' | 'warning' | 'negative' =>
  status === 'good' ? 'positive' : status === 'fair' ? 'warning' : 'negative';

export const statusLabel = (status: ComponentStatus): string =>
  status === 'good' ? 'On target' : status === 'fair' ? 'Watch' : 'Off target';

/** Status → bar color class for thin progress bars. */
export const statusBarClass = (status: ComponentStatus): string =>
  status === 'good' ? 'bg-positive' : status === 'fair' ? 'bg-warning' : 'bg-negative';
