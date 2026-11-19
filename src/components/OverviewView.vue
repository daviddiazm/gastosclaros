<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, CalendarDays, ChevronRight, CirclePlus, ReceiptText, Sparkles } from 'lucide-vue-next'
import type { Category, Expense, NarrativeReport, PaymentMethod } from '../types'

const props = defineProps<{
  expenses: Expense[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  narrative: NarrativeReport | null
  userName: string
  loading: boolean
}>()

const emit = defineEmits<{
  goToExpenses: []
  addExpense: []
}>()

const now = new Date()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const monthExpenses = () => props.expenses.filter((expense) => expense.spentDate.slice(0, 7) === monthKey).length
const commonCategory = () => {
  const counts = new Map<string, number>()
  props.expenses.forEach((expense) => {
    const name = expense.category || 'Sin categoría'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Aún sin datos'
}

const narrativeParagraphs = computed(() =>
  props.narrative?.text
    ? props.narrative.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [],
)

function displayDate(value: string) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function money(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function methodName(expense: Expense) {
  return expense.paymentMethodName || props.paymentMethods.find((method) => method.id === expense.paymentMethodId)?.name || 'Método de pago'
}
</script>

<template>
  <section class="page-content">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">VISTA GENERAL</p>
        <h1>Hola, {{ props.userName || 'qué bueno verte' }}<span class="heading-period">.</span></h1>
        <p class="page-subtitle">Un vistazo sereno a tus movimientos recientes.</p>
      </div>
      <button class="button button-primary" type="button" @click="emit('addExpense')"><CirclePlus :size="17" aria-hidden="true" /> Registrar gasto</button>
    </div>

    <article v-if="props.narrative?.text" class="content-card narrative-card">
      <div class="narrative-header">
        <div class="narrative-title-group">
          <span class="insight-icon"><Sparkles :size="18" aria-hidden="true" /></span>
          <div>
            <p class="eyebrow">ANÁLISIS DEL PERIODO</p>
            <h2>
              {{ displayDate(props.narrative.from) }} – {{ displayDate(props.narrative.to) }}
            </h2>
          </div>
        </div>
        <div class="narrative-total">
          <span>Total del periodo</span>
          <strong>{{ money(props.narrative.total) }}</strong>
        </div>
      </div>

      <div class="narrative-body">
        <p v-for="(paragraph, index) in narrativeParagraphs" :key="index">
          {{ paragraph }}
        </p>
      </div>

      <div class="narrative-footer">
        <button class="text-link" type="button" @click="emit('goToExpenses')">
          Ver movimientos <ArrowUpRight :size="15" aria-hidden="true" />
        </button>
      </div>
    </article>

    <div v-else class="insight-banner">
      <div class="insight-icon"><Sparkles :size="18" aria-hidden="true" /></div>
      <div class="insight-copy"><strong>La claridad empieza con cada registro.</strong><p>Agrega tus gastos y encuentra patrones en tu día a día.</p></div>
      <button class="text-link" type="button" @click="emit('goToExpenses')">Ver movimientos <ArrowUpRight :size="15" aria-hidden="true" /></button>
    </div>

    <div class="stats-grid">
      <article class="stat-card stat-card-primary">
        <div class="stat-top"><span>Movimientos registrados</span><span class="stat-icon"><ReceiptText :size="17" aria-hidden="true" /></span></div>
        <strong class="stat-value">{{ props.loading ? '—' : props.expenses.length.toLocaleString('es-CO') }}</strong>
        <span class="stat-caption">En total</span>
        <div class="stat-decoration stat-decoration-1"></div><div class="stat-decoration stat-decoration-2"></div>
      </article>
      <article class="stat-card">
        <div class="stat-top"><span>Este mes</span><span class="stat-icon stat-icon-soft"><CalendarDays :size="17" aria-hidden="true" /></span></div>
        <strong class="stat-value">{{ props.loading ? '—' : monthExpenses().toLocaleString('es-CO') }}</strong>
        <span class="stat-caption">{{ monthExpenses() === 1 ? 'movimiento' : 'movimientos' }} registrados</span>
      </article>
      <article class="stat-card">
        <div class="stat-top"><span>Categoría frecuente</span><span class="stat-icon stat-icon-soft"><Sparkles :size="17" aria-hidden="true" /></span></div>
        <strong class="stat-value stat-value-category">{{ props.loading ? '—' : commonCategory() }}</strong>
        <span class="stat-caption">{{ props.categories.length }} {{ props.categories.length === 1 ? 'categoría disponible' : 'categorías disponibles' }}</span>
      </article>
    </div>

    <section class="content-card activity-card">
      <div class="section-heading">
        <div><p class="eyebrow">ACTIVIDAD</p><h2>Movimientos recientes</h2></div>
        <button class="subtle-link" type="button" @click="emit('goToExpenses')">Ver todos <ChevronRight :size="16" aria-hidden="true" /></button>
      </div>
      <div v-if="props.loading" class="empty-state"><span class="loading-orb"></span><p>Cargando tus movimientos…</p></div>
      <div v-else-if="props.expenses.length === 0" class="empty-state">
        <span class="empty-icon"><ReceiptText :size="21" aria-hidden="true" /></span>
        <strong>Aquí empieza tu claridad</strong>
        <p>Cuando registres un gasto, lo verás aparecer en esta lista.</p>
        <button class="button button-outline" type="button" @click="emit('addExpense')">Registrar el primero</button>
      </div>
      <div v-else class="activity-list">
        <div v-for="expense in props.expenses.slice(0, 5)" :key="expense.id" class="activity-row">
          <span class="activity-mark"><ReceiptText :size="17" aria-hidden="true" /></span>
          <div class="activity-name"><strong>{{ expense.description }}</strong><span>{{ expense.category || 'Sin categoría' }} · {{ methodName(expense) }}</span></div>
          <span class="activity-date">{{ displayDate(expense.spentDate) }}</span>
        </div>
      </div>
    </section>
    <div class="data-footnote">Tus datos se consultan directamente en tu cuenta. No almacenamos información financiera en este dispositivo.</div>
  </section>
</template>