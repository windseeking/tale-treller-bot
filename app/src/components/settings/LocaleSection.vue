<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SupportedLocale } from '@shared/i18n'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

import { setAppLocale } from '../../i18n'
import { useSettingsApi } from '../../composables/api/useSettingsApi'
import type { SettingsPayload } from '../../types/app'
import { getErrorMessage } from '../../utils/errors'

const props = defineProps<{
  settings: SettingsPayload;
}>()

const emit = defineEmits<{
  'update:settings': [value: SettingsPayload];
}>()

const toast = useToast()
const { t } = useI18n()
const { saveLocale: saveLocaleRequest } = useSettingsApi()

const selectedLocale = ref<SupportedLocale>(props.settings.locale)
const isSavingSettings = ref(false)

watch(
  () => props.settings.locale,
  () => {
    selectedLocale.value = props.settings.locale
  },
  { immediate: true }
)

async function handleLocaleChange(event: { value: SupportedLocale }): Promise<void> {
  if (event.value === props.settings.locale || isSavingSettings.value) {
    return
  }

  isSavingSettings.value = true
  const errorSummary = t('toasts.error')

  try {
    const payload = await saveLocaleRequest(event.value)
    emit('update:settings', payload.settings)
    setAppLocale(payload.settings.locale)
    toast.add({
      severity: 'success',
      summary: t('toasts.saved'),
      detail: t('toasts.localeUpdated'),
      life: 2600
    })
  } catch (error) {
    selectedLocale.value = props.settings.locale
    toast.add({ severity: 'error', summary: errorSummary, detail: getErrorMessage(error), life: 4000 })
  } finally {
    isSavingSettings.value = false
  }
}
</script>

<template>
  <section class="rounded-lg border border-secondary/10 bg-white p-4 shadow-md shadow-secondary/5">
    <div class="mb-3.5 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-md font-bold">
          {{ t('sections.locale.title') }}
        </h2>
        <p class="mt-2 text-xs text-secondary">
          {{ t('sections.locale.description') }}
        </p>
      </div>
    </div>

    <Select
      v-model="selectedLocale"
      :options="settings.localeOptions"
      :disabled="isSavingSettings"
      class="w-full"
      option-label="label"
      option-value="value"
      :placeholder="t('sections.locale.placeholder')"
      @change="handleLocaleChange" />
  </section>
</template>
