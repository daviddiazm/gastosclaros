<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ArrowRight, Eye, EyeOff, Leaf, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  busy: boolean
  apiUrl: string
  errorMessage: string
}>()

const emit = defineEmits<{
  submit: [credentials: { fullName: string; email: string; password: string; registering: boolean }]
  toggleMode: []
}>()

const isRegistering = ref(false)
const showPassword = ref(false)
const form = reactive({ fullName: '', email: '', password: '' })

function submitForm() {
  emit('submit', { ...form, email: form.email.trim(), registering: isRegistering.value })
}
</script>

<template>
  <main class="auth-layout">
    <section class="auth-panel">
      <a class="brand auth-brand" href="#" aria-label="Gasto Claro, inicio">
        <span class="brand-mark"><Leaf :size="19" aria-hidden="true" /></span>
        <span>gasto<span class="brand-light">claro</span></span>
      </a>

      <div class="auth-content">
        <p class="eyebrow">FINANZAS CON INTENCIÓN</p>
        <h1>{{ isRegistering ? 'Empieza con claridad.' : 'Tus gastos, en orden.' }}</h1>
        <p class="auth-lead">
          {{ isRegistering ? 'Crea tu cuenta y toma el control de tu día a día.' : 'Un espacio tranquilo para entender a dónde va tu dinero.' }}
        </p>

        <div v-if="errorMessage" class="alert-box" role="alert">
          <span class="alert-dot" aria-hidden="true"></span>
          <p>{{ errorMessage }}</p>
        </div>

        <form class="auth-form" @submit.prevent="submitForm">
          <label v-if="isRegistering" class="form-field">
            <span>Nombre completo</span>
            <input v-model="form.fullName" type="text" name="fullName" autocomplete="name" placeholder="¿Cómo te llamas?" required minlength="2" />
          </label>
          <label class="form-field">
            <span>Correo electrónico</span>
            <input v-model="form.email" type="email" name="email" autocomplete="email" placeholder="tu@correo.com" required />
          </label>
          <label class="form-field">
            <span>Contraseña</span>
            <span class="password-wrap">
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" name="password" :autocomplete="isRegistering ? 'new-password' : 'current-password'" placeholder="Tu contraseña" required minlength="8" />
              <button class="password-toggle" type="button" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" :size="17" aria-hidden="true" />
                <Eye v-else :size="17" aria-hidden="true" />
              </button>
            </span>
          </label>
          <button class="button button-primary auth-submit" type="submit" :disabled="props.busy">
            <span>{{ props.busy ? 'Un momento…' : isRegistering ? 'Crear cuenta' : 'Iniciar sesión' }}</span>
            <ArrowRight v-if="!props.busy" :size="17" aria-hidden="true" />
          </button>
        </form>

        <p class="auth-switch">
          {{ isRegistering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?' }}
          <button type="button" @click="isRegistering = !isRegistering; emit('toggleMode')">
            {{ isRegistering ? 'Inicia sesión' : 'Regístrate' }}
          </button>
        </p>
        <div class="secure-note"><ShieldCheck :size="15" aria-hidden="true" /> Tu sesión está protegida y nunca guardamos tu contraseña.</div>
      </div>

      <p class="api-endpoint"><span class="endpoint-dot" aria-hidden="true"></span> API conectada a <code>{{ props.apiUrl }}</code></p>
    </section>

    <aside class="auth-aside" aria-label="Una forma más clara de ver tus gastos">
      <div class="aside-orbit orbit-one"></div>
      <div class="aside-orbit orbit-two"></div>
      <div class="aside-content">
        <div class="aside-quote-mark" aria-hidden="true">“</div>
        <p class="aside-quote">Pequeños hábitos, una relación más consciente con tu dinero.</p>
        <p class="aside-caption">GASTO CLARO · FINANZAS PERSONALES</p>
        <div class="aside-card" aria-hidden="true">
          <div class="aside-card-top"><span class="aside-card-dot"></span><span>Tu semana, más clara</span><span class="aside-card-arrow">↗</span></div>
          <div class="mini-bars"><span style="height: 36%"></span><span style="height: 57%"></span><span style="height: 46%"></span><span style="height: 79%"></span><span style="height: 61%"></span><span style="height: 91%"></span><span style="height: 69%"></span></div>
          <div class="mini-labels"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div>
        </div>
      </div>
      <div class="aside-bottom"><span>01</span><span class="aside-line"></span><span>Control, sin complicaciones</span></div>
    </aside>
  </main>
</template>
