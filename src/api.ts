import type { Category, Expense, PaymentMethod, User } from './types'

const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const API_BASE_URL = (configuredUrl || 'http://localhost:8080').replace(/\/+$/, '')

let csrfToken = ''

type ApiObject = Record<string, unknown>
type RequestOptions = {
  method?: string
  jsonBody?: unknown
  rawBody?: string
  needsCsrf?: boolean
  skipCsrf?: boolean
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

function asObject(value: unknown): ApiObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiObject)
    : null
}

function messageFrom(payload: unknown, fallback: string): string {
  const value = asObject(payload)
  if (value) {
    for (const key of ['message', 'error', 'detail', 'title']) {
      if (typeof value[key] === 'string' && value[key]) return value[key] as string
    }
  }
  return typeof payload === 'string' && payload.trim() ? payload : fallback
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.needsCsrf && !csrfToken) await refreshCsrfToken()

  const headers = new Headers({ Accept: 'application/json' })
  const body = options.jsonBody !== undefined || options.rawBody !== undefined
  if (options.jsonBody !== undefined) headers.set('Content-Type', 'application/json')
  if (options.rawBody !== undefined) headers.set('Content-Type', 'application/json')
  if (!options.skipCsrf && csrfToken) headers.set('X-CSRF-TOKEN', csrfToken)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      ...(body
        ? { body: options.rawBody !== undefined ? options.rawBody : JSON.stringify(options.jsonBody) }
        : {}),
    })
  } catch {
    throw new ApiError(
      `No se pudo conectar con ${API_BASE_URL}. Comprueba que la API esté disponible y permita solicitudes CORS con credenciales.`,
    )
  }

  const responseText = response.status === 204 ? '' : await response.text()
  let payload: unknown = null
  if (responseText) {
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = responseText
    }
  }

  if (!response.ok) {
    throw new ApiError(messageFrom(payload, `La API respondió con el estado ${response.status}.`), response.status)
  }

  return payload as T
}

async function refreshCsrfToken(): Promise<void> {
  const payload = await request<unknown>('/api/v1/auth/csrf', { skipCsrf: true })
  const outer = asObject(payload)
  const nested = asObject(outer?.data)
  const token = outer?.token ?? nested?.token
  if (typeof token !== 'string' || !token) {
    throw new ApiError('La respuesta de /auth/csrf no incluyó un token CSRF válido.')
  }
  csrfToken = token
}

function unwrap(payload: unknown, preferredKeys: string[] = []): unknown {
  let value = payload
  for (let depth = 0; depth < 4; depth += 1) {
    const object = asObject(value)
    if (!object) return value
    const key = [...preferredKeys, 'data'].find((candidate) => candidate in object)
    if (!key) return value
    value = object[key]
  }
  return value
}

function collectionFrom(payload: unknown, keys: string[]): ApiObject[] {
  if (Array.isArray(payload)) return payload.map(asObject).filter((item): item is ApiObject => item !== null)
  const object = asObject(payload)
  if (!object) return []
  for (const key of [...keys, 'data', 'items', 'content', 'results']) {
    if (key in object) {
      const result = collectionFrom(object[key], keys.filter((candidate) => candidate !== key))
      if (result.length || Array.isArray(object[key])) return result
    }
  }
  return []
}

function stringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return fallback
}

function normalizeUser(payload: unknown): User {
  const value = asObject(unwrap(payload, ['user', 'owner'])) ?? {}
  return {
    id: stringValue(value.id ?? value.userId ?? value.ownerId),
    fullName: stringValue(value.fullName ?? value.name ?? value.username),
    email: stringValue(value.email),
  }
}

function normalizeExpense(value: ApiObject): Expense {
  const payment = asObject(value.paymentMethod)
  const category = value.category
  const categoryName = typeof category === 'string'
    ? category
    : stringValue(asObject(category)?.name)
  return {
    id: stringValue(value.id ?? value.spentId ?? value.expenseId),
    description: stringValue(value.description, 'Gasto sin descripción'),
    category: categoryName,
    paymentMethodId: stringValue(value.paymentMethodId ?? payment?.id ?? value.payMethodId),
    paymentMethodName: stringValue(payment?.name ?? value.paymentMethodName),
    spentDate: stringValue(value.spentDate ?? value.date ?? value.createdAt),
  }
}

function normalizeCategory(value: ApiObject): Category {
  return {
    id: stringValue(value.id ?? value.categoryId),
    name: stringValue(value.name ?? value.category),
  }
}

function normalizePaymentMethod(value: ApiObject): PaymentMethod {
  return {
    id: stringValue(value.id ?? value.paymentMethodId ?? value.methodId),
    name: stringValue(value.name ?? value.paymentMethod),
  }
}

export async function getCurrentUser(): Promise<User> {
  return normalizeUser(await request('/api/v1/auth/me'))
}

export async function login(email: string, password: string): Promise<User> {
  await refreshCsrfToken()
  await request('/api/v1/auth/login', {
    method: 'POST',
    jsonBody: { email, password },
    needsCsrf: true,
  })
  await refreshCsrfToken()
  return getCurrentUser()
}

export async function register(fullName: string, email: string, password: string): Promise<void> {
  await refreshCsrfToken()
  await request('/api/v1/auth/register', {
    method: 'POST',
    jsonBody: { fullName, email, password },
    needsCsrf: true,
  })
}

export async function logout(): Promise<void> {
  await request('/api/v1/auth/logout', { method: 'POST', needsCsrf: true })
  csrfToken = ''
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const payload = await request<unknown>(`/api/v1/spent/spents/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['spents', 'expenses', 'spent']).map(normalizeExpense)
}

export async function createExpense(data: {
  description: string
  category: string
  paymentMethodId: number
  spentDate: string
  userId: string
}): Promise<void> {
  await request('/api/v1/spent/create', { method: 'POST', jsonBody: data, needsCsrf: true })
}

export async function updateExpense(id: string, data: Omit<Parameters<typeof createExpense>[0], 'userId'>): Promise<void> {
  await request(`/api/v1/spent/edit/${encodeURIComponent(id)}`, {
    method: 'PUT',
    jsonBody: { id: /^\d+$/.test(id) ? Number(id) : id, ...data },
    needsCsrf: true,
  })
}

export async function deleteExpense(id: string): Promise<void> {
  await request(`/api/v1/spent/delete/${encodeURIComponent(id)}`, { method: 'DELETE', needsCsrf: true })
}

export async function getCategories(userId: string): Promise<Category[]> {
  const payload = await request<unknown>(`/api/v1/spent/category/get/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['categories', 'category']).map(normalizeCategory)
}

export async function createCategory(name: string, userId: string): Promise<void> {
  await request('/api/v1/spent/category/create', {
    method: 'POST',
    jsonBody: { name, userId },
    needsCsrf: true,
  })
}

export async function updateCategory(id: string, name: string, userId: string): Promise<void> {
  await request(`/api/v1/spent/category/edit/${encodeURIComponent(id)}`, {
    method: 'PUT',
    jsonBody: { name, userId },
    needsCsrf: true,
  })
}

export async function deleteCategory(category: Category, userId: string): Promise<void> {
  await request(`/api/v1/spent/category/delete/${encodeURIComponent(category.id)}`, {
    method: 'DELETE',
    jsonBody: { name: category.name, userId },
    needsCsrf: true,
  })
}

export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const payload = await request<unknown>(`/api/v1/payment_method/get/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['paymentMethods', 'payment_methods', 'methods']).map(normalizePaymentMethod)
}

export async function createPaymentMethod(name: string, userId: string): Promise<void> {
  await request('/api/v1/payment_method/create', {
    method: 'POST',
    jsonBody: { name, userId },
    needsCsrf: true,
  })
}

export async function updatePaymentMethod(id: string, name: string): Promise<void> {
  await request(`/api/v1/payment_method/edit/${encodeURIComponent(id)}`, {
    method: 'PUT',
    rawBody: name,
    needsCsrf: true,
  })
}

export async function deletePaymentMethod(id: string, name: string): Promise<void> {
  await request(`/api/v1/payment_method/delete/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    rawBody: name,
    needsCsrf: true,
  })
}
