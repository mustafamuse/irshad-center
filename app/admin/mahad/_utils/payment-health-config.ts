import { PaymentHealth } from '../_types'

export interface PaymentHealthConfig {
  className: string
  label: string
}

const PAYMENT_HEALTH_CONFIGS: Record<PaymentHealth, PaymentHealthConfig> = {
  needs_action: {
    className: 'bg-red-100 text-red-800 border-red-200',
    label: 'Needs Action',
  },
  at_risk: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    label: 'At Risk',
  },
  healthy: {
    className: 'bg-green-100 text-green-800 border-green-200',
    label: 'Healthy',
  },
  exempt: {
    className: 'bg-slate-100 text-slate-800 border-slate-200',
    label: 'Exempt',
  },
  pending: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    label: 'Pending',
  },
  inactive: {
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    label: 'Inactive',
  },
}

export function getPaymentHealthConfig(
  health: PaymentHealth
): PaymentHealthConfig {
  return PAYMENT_HEALTH_CONFIGS[health]
}
