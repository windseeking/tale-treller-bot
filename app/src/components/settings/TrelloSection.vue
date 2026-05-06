<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { SupportedLocale } from '@shared/i18n'
import { useI18n } from 'vue-i18n'

import { useTrelloApi } from '../../composables/api/useTrelloApi'
import type { TrelloPayload } from '../../types/app'
import { formatDateTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/errors'

const props = defineProps<{
  trello: TrelloPayload;
  locale: SupportedLocale;
}>()

const emit = defineEmits<{
  'update:trello': [value: TrelloPayload];
}>()

const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const { createConnectLink, disconnect } = useTrelloApi()

const isCreatingConnectLink = ref(false)
const isDisconnecting = ref(false)

const trelloSummary = computed(() => {
  if (props.trello.connected) {
    const expires = props.trello.expiresAt ? formatDateTime(props.trello.expiresAt, props.locale) : t('sections.trello.unknownExpiry')
    return t('sections.trello.connectedSummary', { username: props.trello.username ?? 'unknown', expiresAt: expires })
  }

  if (props.trello.expired) {
    return t('sections.trello.expiredSummary')
  }

  return t('sections.trello.disconnectedSummary')
})

async function openTrelloConnect(): Promise<void> {
  isCreatingConnectLink.value = true

  try {
    const payload = await createConnectLink()
    window.location.href = payload.url
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('toasts.error'),
      detail: getErrorMessage(error),
      life: 4000
    })
  } finally {
    isCreatingConnectLink.value = false
  }
}

function confirmDisconnect(): void {
  confirm.require({
    message: t('sections.trello.confirmDisconnectMessage'),
    header: t('sections.trello.confirmDisconnectHeader'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('sections.trello.disconnect'),
    acceptClass: 'p-button-danger',
    rejectLabel: t('common.cancel'),
    rejectClass: 'p-button-secondary',
    accept: disconnectTrello
  })
}

async function disconnectTrello(): Promise<void> {
  isDisconnecting.value = true

  try {
    const payload = await disconnect()
    emit('update:trello', payload.trello)
    toast.add({
      severity: 'success',
      summary: t('toasts.done'),
      detail: t('toasts.trelloDisconnected'),
      life: 2600
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('toasts.error'),
      detail: getErrorMessage(error),
      life: 4000
    })
  } finally {
    isDisconnecting.value = false
  }
}
</script>

<template>
  <section class="rounded-lg border border-secondary/10 bg-[linear-gradient(135deg,rgba(224,242,254,0.92),rgba(245,243,255,0.76)),#fff] p-4">
    <div class="mb-3.5 flex items-start justify-between gap-3 max-[520px]:block">
      <div>
        <h2 class="text-md font-bold">
          Trello
        </h2>
        <p class="mt-2 text-xs text-secondary">
          {{ trelloSummary }}
        </p>
      </div>
    </div>

    <div class="flex w-full flex-col gap-2.5">
      <Button
        :label="trello.connected ? t('sections.trello.reconnect') : t('sections.trello.connect')"
        icon="pi pi-external-link"
        :loading="isCreatingConnectLink"
        @click="openTrelloConnect" />
      <Button
        v-if="trello.connected || trello.username"
        :label="t('sections.trello.disconnect')"
        icon="pi pi-times"
        severity="danger"
        outlined
        :loading="isDisconnecting"
        @click="confirmDisconnect" />
    </div>
  </section>
</template>
