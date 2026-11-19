<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LogOut, RefreshCw, ShieldCheck, X } from 'lucide-vue-next'
import AppSidebar from './components/AppSidebar.vue'
import AuthView from './components/AuthView.vue'
import ExpensesView from './components/ExpensesView.vue'
import OverviewView from './components/OverviewView.vue'
import ResourcesView from './components/ResourcesView.vue'
import {
  API_BASE_URL,
  ApiError,
  createCategory,
  createExpense,
  createPaymentMethod,
  deleteCategory,
  deleteExpense,
  deletePaymentMethod,
  getCategories,
  getCurrentUser,
  getExpenses,
  getNarrativeReport,
  getPaymentMethods,
  login,
  logout,
  register,
  updateCategory,
  updateExpense,
  updatePaymentMethod,
} from './api'
import type { AppSection, Category, Expense, NarrativeReport, PaymentMethod, User } from './types'

const user = ref<User | null>(null)
const expenses = ref<Expense[]>([])
const categories = ref<Category[]>([])
const paymentMethods = ref<PaymentMethod[]>([])
const narrativeReport = ref<NarrativeReport | null>(null)
const activeSection = ref<AppSection>('overview')
const checkingSession = ref(true)
const busy = ref(false)
const successVersion = ref(0)
const authError = ref('')
const dataError = ref('')
const feedback = ref('')
const feedbackIsError = ref(false)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

function notify(message: string, isError = false) {
  feedback.value = message
  feedbackIsError.value = isError
}

function resetSessionState() {
  user.value = null
  expenses.value = []
  categories.value = []
  paymentMethods.value = []
  narrativeReport.value = null
  activeSection.value = 'overview'
}

function handleExpiredSession(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    resetSessionState()
    authError.value = 'Tu sesión terminó. Inicia sesión de nuevo para continuar.'
    return true
  }
  return false
}

async function loadCollections() {
  if (!user.value) return
  if (!user.value.id) {
    dataError.value = 'El endpoint /api/v1/auth/me no devolvió el identificador de usuario necesario para consultar sus gastos.'
    return
  }
  dataError.value = ''
  const [expenseResult, categoryResult, methodResult, narrativeResult] = await Promise.allSettled([
    getExpenses(user.value.id),
    getCategories(user.value.id),
    getPaymentMethods(user.value.id),
    getNarrativeReport(),
  ])

  const failures: string[] = []
  if (expenseResult.status === 'fulfilled') expenses.value = expenseResult.value
  else failures.push(`gastos: ${errorMessage(expenseResult.reason)}`)
  if (categoryResult.status === 'fulfilled') categories.value = categoryResult.value
  else failures.push(`categorías: ${errorMessage(categoryResult.reason)}`)
  if (methodResult.status === 'fulfilled') paymentMethods.value = methodResult.value
  else failures.push(`métodos de pago: ${errorMessage(methodResult.reason)}`)
  if (narrativeResult.status === 'fulfilled') narrativeReport.value = narrativeResult.value
  else failures.push(`resumen narrativo: ${errorMessage(narrativeResult.reason)}`)

  dataError.value = failures.length ? `No se pudieron cargar ${failures.join(' · ')}.` : ''
}

async function onLogin(credentials: { fullName: string; email: string; password: string; registering: boolean }) {
  busy.value = true
  authError.value = ''
  try {
    if (credentials.registering) {
      await register(credentials.fullName, credentials.email, credentials.password)
    }
    user.value = await login(credentials.email, credentials.password)
    await loadCollections()
    notify(credentials.registering ? 'Tu cuenta está lista.' : 'Sesión iniciada.')
  } catch (error) {
    authError.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}

async function onLogout() {
  busy.value = true
  try {
    await logout()
    user.value = null
    expenses.value = []
    categories.value = []
    paymentMethods.value = []
    activeSection.value = 'overview'
    authError.value = ''
    notify('Sesión cerrada.')
  } catch (error) {
    if (!handleExpiredSession(error)) notify(errorMessage(error), true)
  } finally {
    busy.value = false
  }
}

async function runAction(action: () => Promise<void>, successMessage: string) {
  busy.value = true
  feedback.value = ''
  try {
    await action()
    await loadCollections()
    successVersion.value += 1
    notify(successMessage)
  } catch (error) {
    if (!handleExpiredSession(error)) notify(errorMessage(error), true)
  } finally {
    busy.value = false
  }
}

async function saveExpense(data: { id?: string; cost: number; description: string; categoryId: number; paymentMethodId: number; spentDate: string }) {
  if (!user.value) return
  const { id, ...payload } = data
  await runAction(async () => {
    if (id) await updateExpense(id, payload)
    else await createExpense({ ...payload, userId: user.value!.id })
  }, id ? 'Gasto actualizado.' : 'Gasto registrado.')
}

async function removeExpense(expense: Expense) {
  if (!window.confirm(`¿Eliminar el gasto “${expense.description}”? Esta acción no se puede deshacer.`)) return
  await runAction(() => deleteExpense(expense.id), 'Gasto eliminado.')
}

async function saveResource(item: { type: 'category' | 'paymentMethod'; id?: string; name: string }) {
  if (!user.value) return
  await runAction(async () => {
    if (item.type === 'category') {
      if (item.id) await updateCategory(item.id, item.name)
      else await createCategory(item.name, user.value!.id)
    } else if (item.id) {
      await updatePaymentMethod(item.id, item.name)
    } else {
      await createPaymentMethod(item.name, user.value!.id)
    }
  }, item.id ? 'Cambios guardados.' : 'Elemento agregado.')
}

async function removeResource(item: { type: 'category' | 'paymentMethod'; resource: Category | PaymentMethod }) {
  const label = item.type === 'category' ? 'la categoría' : 'el método de pago'
  if (!window.confirm(`¿Eliminar ${label} “${item.resource.name}”?`)) return
  if (!user.value) return
  await runAction(async () => {
    if (item.type === 'category') await deleteCategory(item.resource.id)
    else await deletePaymentMethod(item.resource.id)
  }, 'Elemento eliminado.')
}

onMounted(async () => {
  try {
    user.value = await getCurrentUser()
    await loadCollections()
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) authError.value = errorMessage(error)
  } finally {
    checkingSession.value = false
  }
})
</script>

<template>
  <div v-if="checkingSession" class="session-loader" role="status"><span class="loading-orb"></span><span>Preparando tu
      espacio…</span></div>
  <AuthView v-else-if="!user" :busy="busy" :api-url="API_BASE_URL" :error-message="authError" @submit="onLogin"
    @toggle-mode="authError = ''" />
  <div v-else class="app-shell">
    <AppSidebar :active="activeSection" :full-name="user.fullName" :email="user.email" :busy="busy"
      @navigate="activeSection = $event" @logout="onLogout" />
    <main class="main-area">
      <header class="topbar">
        <div class="topbar-context"><span class="topbar-brand">GASTO CLARO</span><span
            class="topbar-divider">/</span><span>FINANZAS PERSONALES</span></div>
        <div class="topbar-actions"><span class="session-badge">
            <ShieldCheck :size="14" aria-hidden="true" /> Sesión segura
          </span><button class="button button-quiet topbar-logout" type="button" :disabled="busy" @click="onLogout">
            <LogOut :size="16" aria-hidden="true" /> Salir
          </button></div>
      </header>

      <div v-if="dataError" class="inline-alert" role="alert"><span>{{ dataError }}</span><button class="icon-button"
          type="button" aria-label="Reintentar carga" :disabled="busy" @click="loadCollections">
          <RefreshCw :size="15" aria-hidden="true" />
        </button></div>
      <div v-if="feedback" class="feedback-bar" :class="{ 'feedback-error': feedbackIsError }"
        :role="feedbackIsError ? 'alert' : 'status'"><span>{{ feedback }}</span><button class="icon-button"
          type="button" aria-label="Cerrar aviso" @click="feedback = ''">
          <X :size="15" aria-hidden="true" />
        </button></div>

      <OverviewView
        v-if="activeSection === 'overview'"
        :expenses="expenses"
        :categories="categories"
        :payment-methods="paymentMethods"
        :narrative="narrativeReport"
        :user-name="user.fullName.split(' ')[0]"
        :loading="busy"
        @go-to-expenses="activeSection = 'expenses'"
        @add-expense="activeSection = 'expenses'"
      />
      <ExpensesView v-else-if="activeSection === 'expenses'" :expenses="expenses" :categories="categories"
        :payment-methods="paymentMethods" :loading="busy" :busy="busy" :success-version="successVersion"
        @save="saveExpense" @remove="removeExpense" @go-to-settings="activeSection = 'settings'" />
      <ResourcesView v-else :categories="categories" :payment-methods="paymentMethods" :busy="busy"
        :success-version="successVersion" @save="saveResource" @remove="removeResource" />
    </main>
  </div>
</template>