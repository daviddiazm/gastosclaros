
import type { Category, Expense, NarrativeReport, PaymentMethod, User } from './types'

const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const API_BASE_URL = (configuredUrl || 'http://localhost:8080').replace(/\/+$/, '')

let csrfToken = ''

type ApiObject = Record<string, unknown>
type RequestOptions = {
  method?: string
  jsonBody?: unknown
  rawBody?: string
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
    // El backend devuelve { message, fieldErrors: { campo: "detalle" } } en los 400 de validación.
    const fields = asObject(value.fieldErrors)
    const details = fields
      ? Object.values(fields).filter((item): item is string => typeof item === 'string')
      : []
    for (const key of ['message', 'error', 'detail', 'title']) {
      const text = value[key]
      if (typeof text === 'string' && text) return details.length ? `${text}: ${details.join(' · ')}` : text
    }
  }
  return typeof payload === 'string' && payload.trim() ? payload : fallback
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const mutates = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'

  // El backend rota la cookie CSRF en cada petición autenticada, así que un token
  // solo sirve para UNA petición: se pide justo antes de cada petición que modifica datos.
  if (mutates) await refreshCsrfToken()

  const headers = new Headers({ Accept: 'application/json' })
  const hasBody = options.jsonBody !== undefined || options.rawBody !== undefined
  if (hasBody) headers.set('Content-Type', 'application/json')
  if (mutates && csrfToken) headers.set('X-CSRF-TOKEN', csrfToken)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(hasBody
        ? { body: options.rawBody !== undefined ? options.rawBody : JSON.stringify(options.jsonBody) }
        : {}),
    })
  } catch (error) {
    console.error(`${method} ${path} falló:`, error)
    throw new ApiError(
      `No se pudo conectar con ${API_BASE_URL}. Verifica que la API esté en línea (el detalle está en la consola del navegador).`,
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
  const payload = await request<unknown>('/api/v1/auth/csrf')
  const token = asObject(payload)?.token
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

// SpentResponse del backend: { id, cost, description, category, paymentMethod, spentDate, userId }
// category y paymentMethod llegan como NOMBRE (string), sin id.
function normalizeExpense(value: ApiObject): Expense {
  return {
    id: stringValue(value.id),
    cost: Number(value.cost) || 0,
    description: stringValue(value.description, 'Gasto sin descripción'),
    category: stringValue(value.category),
    paymentMethodName: stringValue(value.paymentMethod),
    spentDate: stringValue(value.spentDate),
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

/* ---------- Autenticación ---------- */

export async function getCurrentUser(): Promise<User> {
  return normalizeUser(await request('/api/v1/auth/me'))
}

export async function login(email: string, password: string): Promise<User> {
  await request('/api/v1/auth/login', { method: 'POST', jsonBody: { email, password } })
  return getCurrentUser()
}

export async function register(fullName: string, email: string, password: string): Promise<void> {
  await request('/api/v1/auth/register', { method: 'POST', jsonBody: { fullName, email, password } })
}

export async function logout(): Promise<void> {
  await request('/api/v1/auth/logout', { method: 'POST' })
  csrfToken = ''
}

/* ---------- Gastos ---------- */

export interface ExpensePayload {
  cost: number
  description: string
  categoryId: number
  paymentMethodId: number
  spentDate: string
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const payload = await request<unknown>(`/api/v1/spent/spents/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['spents', 'expenses', 'spent']).map(normalizeExpense)
}

// SpentRequest: { cost, description, categoryId, paymentMethodId, spentDate, userId }
export async function createExpense(data: ExpensePayload & { userId: string }): Promise<void> {
  await request('/api/v1/spent/create', { method: 'POST', jsonBody: data })
}

// SpentRequestEdit: igual que SpentRequest, sin userId
export async function updateExpense(id: string, data: ExpensePayload): Promise<void> {
  await request(`/api/v1/spent/edit/${encodeURIComponent(id)}`, { method: 'PUT', jsonBody: data })
}

export async function deleteExpense(id: string): Promise<void> {
  await request(`/api/v1/spent/delete/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------- Reportes ---------- */

export async function getNarrativeReport(): Promise<NarrativeReport> {
  const payload = await request<unknown>('/api/v1/report/narrative')
  const value = asObject(unwrap(payload)) ?? {}
  return {
    from: stringValue(value.from),
    to: stringValue(value.to),
    total: Number(value.total) || 0,
    text: stringValue(value.text),
  }
}

/* ---------- Categorías ---------- */

export async function getCategories(userId: string): Promise<Category[]> {
  const payload = await request<unknown>(`/api/v1/category/get/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['categories', 'category']).map(normalizeCategory)
}

export async function createCategory(name: string, userId: string): Promise<void> {
  await request('/api/v1/category/create', { method: 'POST', jsonBody: { name, userId } })
}

// El backend recibe el nombre como cuerpo crudo (@RequestBody String name).
export async function updateCategory(id: string, name: string): Promise<void> {
  await request(`/api/v1/category/edit/${encodeURIComponent(id)}`, { method: 'PUT', rawBody: name })
}

export async function deleteCategory(id: string): Promise<void> {
  await request(`/api/v1/category/delete/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------- Métodos de pago ---------- */

export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const payload = await request<unknown>(`/api/v1/payment_method/get/${encodeURIComponent(userId)}`)
  return collectionFrom(payload, ['paymentMethods', 'payment_methods', 'methods']).map(normalizePaymentMethod)
}

export async function createPaymentMethod(name: string, userId: string): Promise<void> {
  await request('/api/v1/payment_method/create', { method: 'POST', jsonBody: { name, userId } })
}

// El backend recibe el nombre como cuerpo crudo (@RequestBody String name).
export async function updatePaymentMethod(id: string, name: string): Promise<void> {
  await request(`/api/v1/payment_method/edit/${encodeURIComponent(id)}`, { method: 'PUT', rawBody: name })
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await request(`/api/v1/payment_method/delete/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
