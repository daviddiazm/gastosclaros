export interface User {
  id: string
  fullName: string
  email: string
}

export interface Expense {
  id: string
  cost: number
  description: string
  /** Nombre de la categoría: el backend no devuelve su id. */
  category: string
  /** El backend tampoco devuelve este id; se resuelve por nombre contra la lista de métodos. */
  paymentMethodId?: string
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

export interface NarrativeReport {
  from: string
  to: string
  total: number
  text: string
}

export type AppSection = 'overview' | 'expenses' | 'settings'