<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CalendarDays, ChevronDown, CirclePlus, Pencil, ReceiptText, Search, Trash2, X } from 'lucide-vue-next'
import type { Category, Expense, PaymentMethod } from '../types'

const props = defineProps<{
  expenses: Expense[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  loading: boolean
  busy: boolean
  successVersion: number
}>()

const emit = defineEmits<{
  save: [data: { id?: string; description: string; category: string; paymentMethodId: number; spentDate: string }]
  remove: [expense: Expense]
  goToSettings: []
}>()

function todayLocal() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const searchQuery = ref('')
const filterCategory = ref('all')
const modalOpen = ref(false)
const editingId = ref<string>()
const form = reactive({ description: '', category: '', paymentMethodId: '', spentDate: todayLocal() })

const filteredExpenses = computed(() => props.expenses.filter((expense) => {
  const matchesSearch = `${expense.description} ${expense.category} ${expense.paymentMethodName}`.toLocaleLowerCase('es').includes(searchQuery.value.trim().toLocaleLowerCase('es'))
  const matchesCategory = filterCategory.value === 'all' || expense.category === filterCategory.value
  return matchesSearch && matchesCategory
}))

watch(() => props.categories, (categories) => {
  if (!form.category && categories.length) form.category = categories[0].name
}, { immediate: true })
watch(() => props.paymentMethods, (methods) => {
  if (!form.paymentMethodId && methods.length) form.paymentMethodId = methods[0].id
}, { immediate: true })
watch(() => props.successVersion, () => { modalOpen.value = false })

function openNew() {
  editingId.value = undefined
  form.description = ''
  form.category = props.categories[0]?.name ?? ''
  form.paymentMethodId = props.paymentMethods[0]?.id ?? ''
  form.spentDate = todayLocal()
  modalOpen.value = true
}

function openEdit(expense: Expense) {
  editingId.value = expense.id
  form.description = expense.description
  form.category = expense.category
  form.paymentMethodId = expense.paymentMethodId || props.paymentMethods[0]?.id || ''
  form.spentDate = expense.spentDate.slice(0, 10) || todayLocal()
  modalOpen.value = true
}

function save() {
  if (!form.description.trim() || !form.category.trim() || !form.paymentMethodId || !form.spentDate) return
  emit('save', {
    ...(editingId.value ? { id: editingId.value } : {}),
    description: form.description.trim(),
    category: form.category.trim(),
    paymentMethodId: Number(form.paymentMethodId),
    spentDate: form.spentDate,
  })
}

function displayDate(value: string) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function methodName(expense: Expense) {
  return expense.paymentMethodName || props.paymentMethods.find((method) => method.id === expense.paymentMethodId)?.name || 'Sin método'
}
</script>

<template>
  <section class="page-content">
    <div class="welcome-row">
      <div><p class="eyebrow">TU ACTIVIDAD</p><h1>Gastos<span class="heading-period">.</span></h1><p class="page-subtitle">Registra y organiza tus movimientos, uno a uno.</p></div>
      <button class="button button-primary" type="button" @click="openNew"><CirclePlus :size="17" aria-hidden="true" /> Nuevo gasto</button>
    </div>

    <div class="list-toolbar">
      <label class="search-field"><Search :size="17" aria-hidden="true" /><span class="sr-only">Buscar gastos</span><input v-model="searchQuery" type="search" placeholder="Buscar movimientos…" /></label>
      <label class="filter-select"><span class="sr-only">Filtrar por categoría</span><select v-model="filterCategory"><option value="all">Todas las categorías</option><option v-for="category in props.categories" :key="category.id" :value="category.name">{{ category.name }}</option></select><ChevronDown :size="15" aria-hidden="true" /></label>
      <span class="result-count">{{ filteredExpenses.length }} {{ filteredExpenses.length === 1 ? 'movimiento' : 'movimientos' }}</span>
    </div>

    <section class="content-card expense-card">
      <div v-if="props.loading" class="empty-state"><span class="loading-orb"></span><p>Cargando tus gastos…</p></div>
      <div v-else-if="filteredExpenses.length === 0" class="empty-state">
        <span class="empty-icon"><ReceiptText :size="21" aria-hidden="true" /></span>
        <strong>{{ props.expenses.length ? 'No encontramos coincidencias' : 'Todavía no hay gastos' }}</strong>
        <p>{{ props.expenses.length ? 'Prueba con otra búsqueda o categoría.' : 'Registra tu primer movimiento para empezar.' }}</p>
        <button v-if="!props.expenses.length" class="button button-outline" type="button" @click="openNew">Registrar gasto</button>
      </div>
      <div v-else class="expense-table-wrap">
        <table class="expense-table">
          <thead><tr><th>DESCRIPCIÓN</th><th>CATEGORÍA</th><th>MÉTODO DE PAGO</th><th>FECHA</th><th><span class="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="expense in filteredExpenses" :key="expense.id">
              <td><div class="table-description"><span class="table-icon"><ReceiptText :size="16" aria-hidden="true" /></span><strong>{{ expense.description }}</strong></div></td>
              <td><span class="category-chip">{{ expense.category || 'Sin categoría' }}</span></td>
              <td class="table-muted">{{ methodName(expense) }}</td>
              <td class="table-date"><CalendarDays :size="14" aria-hidden="true" /> {{ displayDate(expense.spentDate) }}</td>
              <td><div class="row-actions"><button class="icon-button" type="button" :aria-label="`Editar ${expense.description}`" @click="openEdit(expense)"><Pencil :size="15" aria-hidden="true" /></button><button class="icon-button icon-button-danger" type="button" :aria-label="`Eliminar ${expense.description}`" @click="emit('remove', expense)"><Trash2 :size="15" aria-hidden="true" /></button></div></td>
            </tr>
          </tbody>
        </table>
        <div class="expense-mobile-list">
          <article v-for="expense in filteredExpenses" :key="expense.id" class="mobile-expense-row">
            <span class="table-icon"><ReceiptText :size="16" aria-hidden="true" /></span>
            <div class="mobile-expense-info"><strong>{{ expense.description }}</strong><span>{{ expense.category || 'Sin categoría' }} · {{ displayDate(expense.spentDate) }}</span></div>
            <div class="row-actions"><button class="icon-button" type="button" :aria-label="`Editar ${expense.description}`" @click="openEdit(expense)"><Pencil :size="15" aria-hidden="true" /></button><button class="icon-button icon-button-danger" type="button" :aria-label="`Eliminar ${expense.description}`" @click="emit('remove', expense)"><Trash2 :size="15" aria-hidden="true" /></button></div>
          </article>
        </div>
      </div>
    </section>
    <p class="data-footnote">La colección de API no define importes para los gastos; por eso mostramos movimientos y fechas, sin inventar totales monetarios.</p>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false" @keydown.esc.stop="modalOpen = false">
      <section class="form-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
        <div class="modal-header"><div><p class="eyebrow">{{ editingId ? 'ACTUALIZA EL REGISTRO' : 'NUEVO MOVIMIENTO' }}</p><h2 id="expense-modal-title">{{ editingId ? 'Editar gasto' : 'Registrar un gasto' }}</h2></div><button class="icon-button" type="button" aria-label="Cerrar" @click="modalOpen = false"><X :size="18" aria-hidden="true" /></button></div>
        <form class="modal-form" @submit.prevent="save">
          <label class="form-field"><span>Descripción</span><input v-model="form.description" type="text" maxlength="140" placeholder="Ej. Almuerzo con el equipo" required /></label>
          <label class="form-field"><span>Categoría</span><span class="select-wrap"><select v-model="form.category" required><option v-if="!props.categories.length" value="" disabled>Primero crea una categoría</option><option v-for="category in props.categories" :key="category.id" :value="category.name">{{ category.name }}</option></select><ChevronDown :size="16" aria-hidden="true" /></span></label>
          <label class="form-field"><span>Método de pago</span><span class="select-wrap"><select v-model="form.paymentMethodId" required :disabled="!props.paymentMethods.length"><option v-if="!props.paymentMethods.length" value="" disabled>Agrega un método de pago</option><option v-for="method in props.paymentMethods" :key="method.id" :value="method.id">{{ method.name }}</option></select><ChevronDown :size="16" aria-hidden="true" /></span></label>
          <div v-if="!props.categories.length || !props.paymentMethods.length" class="form-help">Para registrar un gasto necesitas una categoría y un método de pago. <button class="inline-button" type="button" @click="emit('goToSettings'); modalOpen = false">Administrar</button></div>
          <label class="form-field"><span>Fecha</span><input v-model="form.spentDate" type="date" required /></label>
          <div class="modal-actions"><button class="button button-outline" type="button" @click="modalOpen = false">Cancelar</button><button class="button button-primary" type="submit" :disabled="props.busy || !props.paymentMethods.length || !props.categories.length"><span>{{ props.busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar gasto' }}</span></button></div>
        </form>
      </section>
    </div>
  </section>
</template>
