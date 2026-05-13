<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import { useTrelloApi } from '../../composables/api/useTrelloApi'
import { formatDateTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/errors'
import type { TrelloConnection } from '#interfaces/trello/auth/connections-repository'

const props = defineProps<{
  trello: TrelloConnection;
}>()

const emit = defineEmits<{
  'update:trello': [value: TrelloConnection];
}>()

const toast = useToast()
const confirm = useConfirm()
const { createConnectLink, disconnect } = useTrelloApi()

const isCreatingConnectLink = ref(false)
const isDisconnecting = ref(false)

const trelloSummary = computed(() => {
  if (props.trello.connected) {
    const expires = props.trello.expiresAt ? formatDateTime(props.trello.expiresAt) : 'срок неизвестен'
    return `@${props.trello.username ?? 'unknown'}, действует до ${expires}.`
  }

  if (props.trello.expired) {
    return 'Подключение истекло, нужно переподключить аккаунт.'
  }

  return 'Подключите Trello, чтобы создавать карточки.'
})

async function openTrelloConnect(): Promise<void> {
  isCreatingConnectLink.value = true

  try {
    const payload = await createConnectLink()
    window.location.href = payload.url
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: getErrorMessage(error),
      life: 4000
    })
  } finally {
    isCreatingConnectLink.value = false
  }
}

function confirmDisconnect(): void {
  confirm.require({
    message: 'Отключить Trello для этого Telegram-пользователя?',
    header: 'Отключить Trello',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Отключить',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Отмена',
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
      summary: 'Готово',
      detail: 'Trello отключен.',
      life: 2600
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
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
        :label="trello.connected ? 'Переподключить Trello' : 'Подключить Trello'"
        icon="pi pi-external-link"
        :loading="isCreatingConnectLink"
        @click="openTrelloConnect" />
      <Button
        v-if="trello.connected || trello.username"
        label="Отключить"
        icon="pi pi-times"
        severity="danger"
        outlined
        :loading="isDisconnecting"
        @click="confirmDisconnect" />
    </div>
  </section>
</template>
