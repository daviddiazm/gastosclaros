export interface User {
  id: string
  fullName: string
  email: string
}

export interface Expense {
  id: string
  description: string
  category: string
  paymentMethodId: string
  paymentMethodName: string
  spentDate: string
}

export interface Category {
  id: string
  name: string
}

export interface PaymentMethod {
  id: string
  name: string
}

export type AppSection = 'overview' | 'expenses' | 'settings'
