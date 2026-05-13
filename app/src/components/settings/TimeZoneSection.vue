<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import type { SettingsPayload } from '#interfaces/settings/settings-payload'
import type { TimeZoneOption } from '#interfaces/settings/time-zone-option'
import { useSettingsApi } from '../../composables/api/useSettingsApi'
import { getErrorMessage } from '../../utils/errors'

const props = defineProps<{
  settings: SettingsPayload;
  timeZones: TimeZoneOption[];
}>()

const emit = defineEmits<{
  'update:settings': [value: SettingsPayload];
}>()

const toast = useToast()
const { saveTimeZone: saveTimeZoneRequest } = useSettingsApi()

const filteredTimeZones = ref<TimeZoneOption[]>([])
const selectedTimeZone = ref<TimeZoneOption | null>(null)
const detectMessage = ref('')
const detectSeverity = ref<'success' | 'warn'>('success')
const isSavingSettings = ref(false)

watch(
  () => [props.settings, props.timeZones] as const,
  () => {
    filteredTimeZones.value = props.timeZones.slice(0, 25)
    selectedTimeZone.value = findTimeZone(props.settings.timeZone ?? props.settings.defaultTimeZone)
  },
  { immediate: true }
)

function searchTimeZones(event: { query: string }): void {
  const query = event.query.trim().toLowerCase()
  if (!query) {
    filteredTimeZones.value = props.timeZones
    return
  }

  filteredTimeZones.value = props.timeZones.filter(
    (option) => option.name.toLowerCase().includes(query) || option.offset.toLowerCase().includes(query)
  )
}

async function detectTimeZone(): Promise<void> {
  if (isSavingSettings.value) {
    return
  }

  detectMessage.value = ''

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  const option = detected ? findTimeZone(detected) : null

  if (!option) {
    detectSeverity.value = 'warn'
    detectMessage.value = 'Не удалось определить часовой пояс. Выберите его вручную в списке.'
    return
  }

  selectedTimeZone.value = option
  await saveTimeZone(option)
}

async function handleTimeZoneSelect(event: { value: TimeZoneOption }): Promise<void> {
  detectMessage.value = ''
  await saveTimeZone(event.value)
}

async function saveTimeZone(option: TimeZoneOption | null): Promise<void> {
  if (!option || option.name === props.settings.timeZone || isSavingSettings.value) {
    return
  }

  detectMessage.value = ''
  isSavingSettings.value = true

  try {
    const payload = await saveTimeZoneRequest(option.name)
    emit('update:settings', payload.settings)
    selectedTimeZone.value = findTimeZone(payload.settings.timeZone ?? payload.settings.defaultTimeZone)
    toast.add({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Часовой пояс обновлен.',
      life: 2600
    })
  } catch (error) {
    selectedTimeZone.value = findTimeZone(props.settings.timeZone ?? props.settings.defaultTimeZone)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: getErrorMessage(error),
      life: 4000
    })
  } finally {
    isSavingSettings.value = false
  }
}

function findTimeZone(value: string | null): TimeZoneOption | null {
  if (!value) {
    return null
  }

  return props.timeZones.find((option) => option.name === value) ?? null
}
</script>

<template>
  <section class="rounded-lg border border-secondary/10 bg-white p-4 shadow-md shadow-secondary/5">
    <div class="mb-3.5 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-md font-bold">
          Часовой пояс
        </h2>
        <p class="mt-2 text-xs text-secondary">
          Используется для распознавания сроков в задачах.
        </p>
      </div>
    </div>

    <div class="mb-2.5 flex items-start gap-2">
      <AutoComplete
        v-model="selectedTimeZone"
        :suggestions="filteredTimeZones"
        :disabled="isSavingSettings"
        class="grow"
        option-label="name"
        dropdown
        force-selection
        placeholder="Найти город или IANA timezone"
        @complete="searchTimeZones"
        @option-select="handleTimeZoneSelect">
        <template #option="slotProps">
          <div class="flex w-full items-center justify-between gap-2">
            <span>{{ slotProps.option.name }}</span>
            <Badge
              severity="info"
              size="small">
              {{ slotProps.option.offset }}
            </Badge>
          </div>
        </template>
      </AutoComplete>
      <Button
        v-tooltip.bottom="'Определить автоматически'"
        class="shrink-0"
        icon="pi pi-compass"
        severity="secondary"
        aria-label="Определить автоматически"
        :loading="isSavingSettings"
        @click="detectTimeZone" />
    </div>

    <Message
      v-if="detectMessage"
      :severity="detectSeverity"
      :closable="false">
      {{ detectMessage }}
    </Message>
  </section>
</template>
