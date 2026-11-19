<script setup lang="ts">
import { LayoutDashboard, LogOut, ReceiptText, Tags, WalletCards } from 'lucide-vue-next'
import type { AppSection } from '../types'

const props = defineProps<{
  active: AppSection
  fullName: string
  email: string
  busy: boolean
}>()

const emit = defineEmits<{
  navigate: [section: AppSection]
  logout: []
}>()

const items = [
  { id: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
  { id: 'expenses' as const, label: 'Gastos', icon: ReceiptText },
  { id: 'settings' as const, label: 'Categorías y pagos', icon: Tags },
]
</script>

<template>
  <aside class="sidebar">
    <a class="brand sidebar-brand" href="#" aria-label="Gasto Claro, inicio" @click.prevent="emit('navigate', 'overview')">
      <span class="brand-mark"><WalletCards :size="19" aria-hidden="true" /></span>
      <span>gasto<span class="brand-light">claro</span></span>
    </a>

    <div class="sidebar-label">TU ESPACIO</div>
    <nav class="side-nav" aria-label="Navegación principal">
      <button
        v-for="item in items"
        :key="item.id"
        class="nav-item"
        :class="{ 'nav-item-active': props.active === item.id }"
        type="button"
        :aria-current="props.active === item.id ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" :size="18" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <span v-if="item.id === 'expenses'" class="nav-indicator" aria-hidden="true"></span>
      </button>
    </nav>

    <div class="sidebar-spacer"></div>
    <div class="sidebar-note">
      <span class="note-icon"><WalletCards :size="17" aria-hidden="true" /></span>
      <div><strong>Un paso a la vez</strong><p>La claridad también es progreso.</p></div>
    </div>
    <div class="profile-card">
      <div class="avatar" aria-hidden="true">{{ (props.fullName || props.email || 'U').slice(0, 1).toUpperCase() }}</div>
      <div class="profile-copy"><strong>{{ props.fullName || 'Mi cuenta' }}</strong><span>{{ props.email }}</span></div>
      <button class="icon-button logout-button" type="button" aria-label="Cerrar sesión" :disabled="props.busy" @click="emit('logout')">
        <LogOut :size="17" aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>
