<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CreditCard, Pencil, Plus, Tag, Trash2, X } from 'lucide-vue-next'
import type { Category, PaymentMethod } from '../types'

type ResourceType = 'category' | 'paymentMethod'
type Resource = Category | PaymentMethod

const props = defineProps<{
  categories: Category[]
  paymentMethods: PaymentMethod[]
  busy: boolean
  successVersion: number
}>()

const emit = defineEmits<{
  save: [item: { type: ResourceType; id?: string; name: string }]
  remove: [item: { type: ResourceType; resource: Resource }]
}>()

const activeType = ref<ResourceType>('category')
const editingId = ref<string>()
const modalOpen = ref(false)
const name = ref('')
const items = computed(() => activeType.value === 'category' ? props.categories : props.paymentMethods)
const typeLabel = computed(() => activeType.value === 'category' ? 'categorías' : 'métodos de pago')

watch(activeType, () => { modalOpen.value = false; editingId.value = undefined })
watch(() => props.successVersion, () => { modalOpen.value = false })

function openNew() {
  editingId.value = undefined
  name.value = ''
  modalOpen.value = true
}
function openEdit(item: Resource) {
  editingId.value = item.id
  name.value = item.name
  modalOpen.value = true
}
function save() {
  const cleanName = name.value.trim()
  if (!cleanName) return
  emit('save', { type: activeType.value, ...(editingId.value ? { id: editingId.value } : {}), name: cleanName })
}
</script>

<template>
  <section class="page-content">
    <div class="welcome-row">
      <div><p class="eyebrow">PERSONALIZA TU ESPACIO</p><h1>Organización<span class="heading-period">.</span></h1><p class="page-subtitle">Prepara tus categorías y formas de pago para registrar gastos.</p></div>
      <button class="button button-primary" type="button" @click="openNew"><Plus :size="17" aria-hidden="true" /> Agregar {{ activeType === 'category' ? 'categoría' : 'método' }}</button>
    </div>

    <div class="resource-tabs" role="tablist" aria-label="Tipo de recurso">
      <button class="resource-tab" :class="{ 'resource-tab-active': activeType === 'category' }" type="button" role="tab" :aria-selected="activeType === 'category'" @click="activeType = 'category'"><Tag :size="16" aria-hidden="true" /> Categorías <span>{{ props.categories.length }}</span></button>
      <button class="resource-tab" :class="{ 'resource-tab-active': activeType === 'paymentMethod' }" type="button" role="tab" :aria-selected="activeType === 'paymentMethod'" @click="activeType = 'paymentMethod'"><CreditCard :size="16" aria-hidden="true" /> Métodos de pago <span>{{ props.paymentMethods.length }}</span></button>
    </div>

    <section class="content-card resource-card">
      <div class="resource-heading"><div><p class="eyebrow">TU LISTA</p><h2>{{ activeType === 'category' ? 'Categorías de gastos' : 'Métodos de pago' }}</h2></div><span class="resource-total">{{ items.length }} {{ items.length === 1 ? 'elemento' : 'elementos' }}</span></div>
      <div v-if="items.length === 0" class="empty-state resource-empty"><span class="empty-icon"><Tag v-if="activeType === 'category'" :size="21" aria-hidden="true" /><CreditCard v-else :size="21" aria-hidden="true" /></span><strong>Tu lista está esperando</strong><p>Añade {{ activeType === 'category' ? 'categorías para agrupar tus gastos' : 'métodos de pago para tus movimientos' }}.</p><button class="button button-outline" type="button" @click="openNew">Agregar {{ activeType === 'category' ? 'categoría' : 'método de pago' }}</button></div>
      <div v-else class="resource-list">
        <article v-for="item in items" :key="item.id" class="resource-row">
          <span class="resource-item-icon"><Tag v-if="activeType === 'category'" :size="17" aria-hidden="true" /><CreditCard v-else :size="17" aria-hidden="true" /></span>
          <strong>{{ item.name }}</strong>
          <span class="resource-row-actions"><button class="icon-button" type="button" :aria-label="`Editar ${item.name}`" @click="openEdit(item)"><Pencil :size="15" aria-hidden="true" /></button><button class="icon-button icon-button-danger" type="button" :aria-label="`Eliminar ${item.name}`" @click="emit('remove', { type: activeType, resource: item })"><Trash2 :size="15" aria-hidden="true" /></button></span>
        </article>
      </div>
    </section>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false" @keydown.esc.stop="modalOpen = false">
      <section class="form-modal form-modal-small" role="dialog" aria-modal="true" aria-labelledby="resource-modal-title">
        <div class="modal-header"><div><p class="eyebrow">{{ editingId ? 'EDITA TU LISTA' : 'AÑADE A TU LISTA' }}</p><h2 id="resource-modal-title">{{ editingId ? 'Editar' : 'Nueva' }} {{ activeType === 'category' ? 'categoría' : 'forma de pago' }}</h2></div><button class="icon-button" type="button" aria-label="Cerrar" @click="modalOpen = false"><X :size="18" aria-hidden="true" /></button></div>
        <form class="modal-form" @submit.prevent="save">
          <label class="form-field"><span>Nombre</span><input v-model="name" type="text" maxlength="60" :placeholder="activeType === 'category' ? 'Ej. Transporte' : 'Ej. Tarjeta débito'" required /></label>
          <p class="form-help">Se guardará en tus {{ typeLabel }} de la cuenta.</p>
          <div class="modal-actions"><button class="button button-outline" type="button" @click="modalOpen = false">Cancelar</button><button class="button button-primary" type="submit" :disabled="props.busy || !name.trim()">{{ props.busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar' }}</button></div>
        </form>
      </section>
    </div>
  </section>
</template>
